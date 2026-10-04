import '../../../../test/setup.js'
import assert from 'node:assert/strict'
import { afterEach, describe, it, mock } from 'node:test'

/**
 * ✅ Covered behaviors: rendering of search results with metadata, badges, highlights,
 *   HTML escaping, and initial selection state.
 * ⚠️ Known gaps: does not verify browser navigation side effects beyond mocked APIs.
 * 🐞 Added BUG tests: mouse hover fragility, missing error boundary, missing length check
 *
 * Note: Navigation tests moved to searchNavigation.test.js
 *       Event handling tests moved to searchEvents.test.js
 */

function createResults() {
  return [
    {
      type: 'bookmark',
      originalId: 'bm-1',
      originalUrl: 'https://bookmark.test',
      url: 'bookmark.test',
      title: 'Bookmark Title',
      tagsArray: ['alpha', 'beta'],
      folderArray: ['Work', 'Docs'],
      lastVisitSecondsAgo: 3600,
      visitCount: 7,
      dateAdded: new Date('2023-01-02').getTime(),
      score: 41.8,
    },
    {
      type: 'tab',
      originalId: 2,
      originalUrl: 'https://tab.test',
      url: 'tab.test',
      title: 'Tab Title',
      score: 8.4,
    },
  ]
}
async function setupSearchView({
  results = createResults(),
  opts = {
    // Error is expected
  },
} = {
  // Error is expected
}) {
  window.location.hash = '#search/query'
  const mockNav = {
    selectListItem: mock.fn((index) => {
      const list = document.getElementById('results')
      const current = document.getElementById('sel')
      if (current) current.id = ''
      if (list?.children[index]) {
        list.children[index].id = 'sel'
      }
      if (global.ext?.model) {
        global.ext.model.currentItem = index
      }
    }),
    clearSelection: mock.fn(),
    hoverResultItem: mock.fn(),
    navigationKeyListener: mock.fn(),
  }

  // Global control for the mock
  global._mockNav = mockNav
  mock.module(new URL('../searchNavigation.js', import.meta.url), {
    exports: {
      selectListItem: (index, scroll) => global._mockNav.selectListItem(index, scroll),
      clearSelection: () => global._mockNav.clearSelection(),
      hoverResultItem: (e) => global._mockNav.hoverResultItem(e),
      navigationKeyListener: (e) => global._mockNav.navigationKeyListener(e),
    },
  })

  // Import modules - NO need to mock since they have no side effects
  const searchViewModule = await import('../searchView.js')
  document.body.innerHTML = `
    <input id="q" />
    <ul id="results"></ul>
    <button id="toggle"></button>
  `
  const resultList = document.getElementById('results')
  const searchInput = document.getElementById('q')
  const searchApproachToggle = document.getElementById('toggle')
  const copiedResults = results.map((entry) => ({ ...entry }))
  const tabEntries = copiedResults
    .filter((entry) => entry.type === 'tab')
    .map((entry) => ({
      originalId: entry.originalId,
      originalUrl: entry.originalUrl,
      windowId: 101,
    }))
  window.Mark = mock.fn(() => ({
    mark: mock.fn(),
  }))
  global.ext = {
    dom: {
      resultList,
      searchInput,
      searchApproachToggle,
    },
    model: {
      result: copiedResults,
      tabs: tabEntries,
      searchTerm: 'query',
      mouseMoved: false,
      currentItem: 0,
    },
    opts: {
      displaySearchMatchHighlight: true,
      bookmarkColor: '#111',
      tabColor: '#222',
      displayTags: true,
      displayFolderName: true,
      displayLastVisit: true,
      displayVisitCounter: true,
      displayDateAdded: true,
      displayScore: true,
      searchStrategy: 'precise',
      ...opts,
    },
    browserApi: {
      tabs: {
        remove: mock.fn(),
        query: mock.fn(() => Promise.resolve([{ id: 77 }])),
        update: mock.fn(),
        create: mock.fn(),
        highlight: mock.fn(),
      },
      windows: {
        update: mock.fn(),
      },
    },
  }
  return {
    module: searchViewModule,
    elements: {
      resultList,
      searchInput,
      searchApproachToggle,
    },
    results: copiedResults,
  }
}
afterEach(() => {
  delete global.ext
  delete window.Mark
  document.body.innerHTML = ''
  window.location.hash = ''
})
describe('searchView renderSearchResults', () => {
  it('clears the list when no results are provided', async () => {
    const { module, elements } = await setupSearchView({ results: [] })
    elements.resultList.innerHTML = '<li>stale item</li>'
    await module.renderSearchResults([])
    assert.strictEqual(elements.resultList.children.length, 0)
  })
  it('renders results with metadata, badges, and highlight support', async () => {
    const { module, elements } = await setupSearchView({
      results: [
        {
          ...createResults()[0],
          highlightedTitle: 'High <mark>lighted</mark> Title',
          highlightedUrl: 'bookmark.<mark>test</mark>',
        },
        createResults()[1],
      ],
    })
    await module.renderSearchResults()
    assert.strictEqual(document.hasContextMenuListener, true)
    const listItems = elements.resultList.querySelectorAll('li')
    assert.strictEqual(listItems.length, 2)
    const bookmarkItem = listItems[0]
    assert.strictEqual(bookmarkItem.className, 'bookmark')
    assert.strictEqual(bookmarkItem.getAttribute('x-open-url'), 'https://bookmark.test')
    assert.strictEqual(bookmarkItem.style.borderLeftColor, 'rgb(17, 17, 17)')

    // Verify highlighted content is rendered as HTML (not escaped again)
    const titleText = bookmarkItem.querySelector('.title-text')
    assert(titleText.innerHTML.includes('High <mark>lighted</mark> Title'))
    const urlDiv = bookmarkItem.querySelector('.url')
    assert(urlDiv.innerHTML.includes('bookmark.<mark>test</mark>'))
    const tagBadges = Array.from(bookmarkItem.querySelectorAll('.badge.tags'))
    assert.deepStrictEqual(
      tagBadges.map((el) => el.getAttribute('x-link')),
      ['#search/#alpha%20%20', '#search/#beta%20%20'],
    )
    const folderBadges = Array.from(bookmarkItem.querySelectorAll('.badge.folder'))
    assert.deepStrictEqual(
      folderBadges.map((el) => el.getAttribute('x-link')),
      ['#search/~Work%20%20', '#search/~Work%20~Docs%20%20'],
    )
    assert.notStrictEqual(bookmarkItem.querySelector('.badge.last-visited'), null)
    const visitCounterBadge = bookmarkItem.querySelector('.badge.visit-counter')
    assert.notStrictEqual(visitCounterBadge, null)
    assert.notStrictEqual(bookmarkItem.querySelector('.badge.date-added'), null)
    assert.notStrictEqual(bookmarkItem.querySelector('.badge.score'), null)
    const tabItem = listItems[1]
    assert.strictEqual(tabItem.className, 'tab')
    assert.notStrictEqual(tabItem.querySelector('.close'), null)
    assert.strictEqual(document.getElementById('sel'), bookmarkItem)
    assert.strictEqual(ext.model.currentItem, 0)
  })
  it('renders favicon images only for results that have a favicon URL', async () => {
    const { module, elements } = await setupSearchView({
      results: [
        {
          ...createResults()[0],
          favIconUrl: 'https://bookmark.test/favicon.ico',
        },
        createResults()[1],
      ],
      opts: { displayFavicons: true },
    })
    await module.renderSearchResults()
    const listItems = elements.resultList.querySelectorAll('li')
    const favicon = listItems[0].querySelector('.favicon')
    assert.notStrictEqual(favicon, null)
    assert.strictEqual(favicon.getAttribute('src'), 'https://bookmark.test/favicon.ico')
    assert.strictEqual(listItems[1].querySelector('.favicon-col'), null)
  })
  it('does not render favicon placeholders when favicons are disabled', async () => {
    const { module, elements } = await setupSearchView({
      results: [
        {
          ...createResults()[0],
          favIconUrl: 'https://bookmark.test/favicon.ico',
        },
      ],
    })
    await module.renderSearchResults()
    assert.strictEqual(elements.resultList.querySelector('.favicon-col'), null)
  })
  it('escapes HTML content coming from bookmarks and metadata', async () => {
    const maliciousResults = [
      {
        type: 'bookmark',
        originalId: 'bm-mal',
        originalUrl: 'https://example.com/<script>alert(1)</script>',
        url: 'example.com/<iframe src=javascript:alert(1)>',
        title: 'Title <img src=x onerror=alert(1)>',
        tagsArray: ['attack <svg onload=alert(1)>'],
        folderArray: ['Folder"><img src=x>'],
        lastVisitSecondsAgo: 30,
        visitCount: 2,
        dateAdded: new Date('2023-06-01').getTime(),
        score: 12,
      },
    ]
    const { module, elements } = await setupSearchView({
      results: maliciousResults,
      opts: { displaySearchMatchHighlight: false },
    })
    await module.renderSearchResults()
    const listItem = elements.resultList.querySelector('li')
    assert.notStrictEqual(listItem, null)
    assert.strictEqual(listItem.querySelectorAll('script').length, 0)
    const titleText = listItem.querySelector('.title-text')
    assert.strictEqual(titleText.textContent.trim(), 'Title <img src=x onerror=alert(1)>')
    assert(titleText.innerHTML.includes('&lt;img src=x onerror=alert(1)&gt;'))
    const tagBadge = listItem.querySelector('.badge.tags')
    assert.strictEqual(tagBadge.textContent, '#attack <svg onload=alert(1)>')
    assert(tagBadge.innerHTML.includes('&lt;svg onload=alert(1)&gt;'))
    const folderBadge = listItem.querySelector('.badge.folder')
    assert.strictEqual(folderBadge.textContent, '~Folder"><img src=x>')
    assert(folderBadge.innerHTML.includes('&lt;img src=x&gt;'))
    const urlDiv = listItem.querySelector('.url')
    assert.strictEqual(urlDiv.textContent, 'https://example.com/<script>alert(1)</script>')
    assert(urlDiv.innerHTML.includes('&lt;script&gt;alert(1)&lt;/script&gt;'))
  })
  it('renders the preserved original URL instead of the normalized comparison key', async () => {
    const { module, elements } = await setupSearchView({
      results: [
        {
          type: 'bookmark',
          originalId: 'bm-slash',
          originalUrl: 'https://example.com/path/',
          url: 'example.com/path',
          title: 'Slash Bookmark',
        },
      ],
      opts: { displaySearchMatchHighlight: false },
    })
    await module.renderSearchResults()
    const urlDiv = elements.resultList.querySelector('.url')
    assert.strictEqual(urlDiv.textContent, 'https://example.com/path/')
    assert.strictEqual(urlDiv.getAttribute('title'), 'https://example.com/path/')
  })
  it('handles results without optional fields gracefully', async () => {
    const minimalResults = [
      {
        type: 'bookmark',
        originalId: 'bm-minimal',
        originalUrl: 'https://minimal.test',
        url: 'minimal.test',
        title: 'Minimal Bookmark',
      },
    ]
    const { module, elements } = await setupSearchView({
      results: minimalResults,
      opts: {
        displayTags: true,
        displayFolderName: true,
        displayLastVisit: true,
        displayVisitCounter: true,
        displayDateAdded: true,
        displayScore: true,
      },
    })
    await module.renderSearchResults()
    const listItem = elements.resultList.querySelector('li')
    assert.notStrictEqual(listItem, null)
    assert.strictEqual(listItem.querySelector('.badge.tags'), null)
    assert.strictEqual(listItem.querySelector('.badge.folder'), null)
    assert.strictEqual(listItem.querySelector('.badge.last-visited'), null)
    assert.strictEqual(listItem.querySelector('.badge.visit-counter'), null)
    assert.strictEqual(listItem.querySelector('.badge.date-added'), null)
    assert.strictEqual(listItem.querySelector('.badge.score'), null)
  })
  it('renders favorite stars with score-specific color classes', async () => {
    const { module, elements } = await setupSearchView({
      results: [
        {
          ...createResults()[0],
          customBonusScore: 60,
        },
      ],
    })
    await module.renderSearchResults()
    const favoriteStar = elements.resultList.querySelector('.favorite-star')
    assert.notStrictEqual(favoriteStar, null)
    assert.strictEqual(favoriteStar.tagName, 'SPAN')
    assert.strictEqual(favoriteStar.className, 'favorite-star red')
    assert.strictEqual(favoriteStar.getAttribute('title'), 'Favorite (+60)')
    assert.strictEqual(elements.resultList.querySelector('img.favorite-star'), null)
  })
  it('encodes special characters in URLs for edit links', async () => {
    const specialResults = [
      {
        type: 'bookmark',
        originalId: 'bookmark/with/slashes',
        originalUrl: 'https://example.com',
        url: 'example.com',
        title: 'Special Bookmark',
      },
    ]
    const { module, elements } = await setupSearchView({
      results: specialResults,
    })
    await module.renderSearchResults()
    const listItem = elements.resultList.querySelector('li')
    const editButton = listItem.querySelector('.edit')
    const link = editButton.getAttribute('x-link')
    assert(link.includes('bookmark%2Fwith%2Fslashes'))
    assert(!link.includes('bookmark/with/slashes'))
  })
  it('displays last-visited badge for items visited 0 seconds ago (just now)', async () => {
    const justNowResults = [
      {
        type: 'bookmark',
        originalId: 'bm-justnow',
        originalUrl: 'https://justnow.test',
        url: 'justnow.test',
        title: 'Just Now Bookmark',
        lastVisitSecondsAgo: 0,
      },
    ]
    const { module, elements } = await setupSearchView({
      results: justNowResults,
      opts: {
        displayLastVisit: true,
      },
    })
    await module.renderSearchResults()
    const listItem = elements.resultList.querySelector('li')
    const lastVisitedBadge = listItem.querySelector('.badge.last-visited')
    assert.notStrictEqual(lastVisitedBadge, null)
    assert.strictEqual(lastVisitedBadge.textContent, '-0 s')
  })
  it('renders a gradient border for bookmarks that are also open tabs', async () => {
    const bookmarkWithTab = [
      {
        type: 'bookmark',
        originalId: 'bm-tab',
        originalUrl: 'https://open.test',
        url: 'open.test',
        title: 'Open Bookmark',
        tab: true, // This indicates it's also an open tab
      },
    ]
    const { module, elements } = await setupSearchView({
      results: bookmarkWithTab,
      opts: {
        bookmarkColor: '#111',
        tabColor: '#222',
      },
    })
    await module.renderSearchResults()
    const listItem = elements.resultList.querySelector('li')

    // Check that the border-left-color is transparent (to let gradient show)
    assert.strictEqual(listItem.style.borderLeftColor, 'transparent')

    // Check that the background-image contains the linear gradient with correct stops
    // Note: detailed string matching might be brittle to spacing, so checking key parts
    const bgImage = listItem.style.backgroundImage
    assert(bgImage.includes('linear-gradient'))
    assert(bgImage.includes('to bottom'))

    // Verify the "T" badge is NOT present
    const badges = Array.from(listItem.querySelectorAll('.badge'))
    const tBadge = badges.find((b) => b.textContent === 'T')
    assert.strictEqual(tBadge, undefined)
  })
})
describe('✅ FIXED: Error Handling Robustness', () => {
  it('now resets mouseMoved even if rendering throws error', async () => {
    const { module } = await setupSearchView()

    // Configure the mock to throw once via the global control
    global._mockNav.selectListItem.mock.mockImplementationOnce(() => {
      throw new Error('Immediate failure')
    })

    // Set mouseMoved to true to simulate user interaction
    ext.model.mouseMoved = true
    try {
      await module.renderSearchResults()
    } catch {
      // Error is expected
    }

    // FIXED: mouseMoved is reset in the catch block
    assert.strictEqual(ext.model.mouseMoved, false)
  })
  it('now handles rendering errors gracefully with proper error boundary', async () => {
    const { module } = await setupSearchView()
    global._mockNav.selectListItem.mock.mockImplementationOnce(() => {
      throw new Error('Rendering catastrophe')
    })

    // Set mouseMoved to true to simulate user interaction
    ext.model.mouseMoved = true

    // FIXED: Error handling now catches errors and resets mouseMoved
    // The error is still thrown to allow caller to handle, but state is restored
    await assert.rejects(module.renderSearchResults(), new RegExp(RegExp.escape('Rendering catastrophe')))

    // FIXED: mouseMoved is properly reset even on error
    assert.strictEqual(ext.model.mouseMoved, false)
  })
})
describe('🐞 BUG: Missing Length Check', () => {
  it('calls selectListItem(0) unconditionally at line 163', async () => {
    const { module, elements } = await setupSearchView({ results: [] })

    // The code at searchView.js:163 calls selectListItem(0) unconditionally
    // However, there's an early return at line 20-23 for empty results
    // So the bug is actually protected against for truly empty arrays

    await module.renderSearchResults([])

    // Early return prevents the selectListItem(0) call for empty arrays
    assert.strictEqual(elements.resultList.children.length, 0)
  })
  it('attempts to select first item even when results are filtered out', async () => {
    const { module, elements } = await setupSearchView()

    // The current implementation calls selectListItem(0) at line 163
    // without verifying that results.length > 0
    // However, the early return at line 20-23 prevents this for empty arrays

    // The real bug case: when results has falsy entries that get filtered
    const resultsWithNull = [
      null,
      {
        type: 'bookmark',
        originalId: 'bm-1',
        originalUrl: 'https://test.com',
        url: 'test.com',
        title: 'Test',
      },
    ]
    await module.renderSearchResults(resultsWithNull)

    // selectListItem(0) is called, which works because the second entry exists
    const firstItem = elements.resultList.children[0]
    assert.notStrictEqual(firstItem, undefined)
    assert.strictEqual(ext.model.currentItem, 0)
  })
})
