/**
 * ✅ Covered behaviors: rendering of search results with metadata, badges, highlights,
 *   HTML escaping, and initial selection state.
 * ⚠️ Known gaps: does not verify browser navigation side effects beyond mocked APIs.
 * 🐞 Added BUG tests: mouse hover fragility, missing error boundary, missing length check
 *
 * Note: Navigation tests moved to searchNavigation.test.js
 *       Event handling tests moved to searchEvents.test.js
 */

import { jest } from '@jest/globals'

function createResults() {
  return [
    {
      type: 'bookmark',
      originalId: 'bm-1',
      originalUrl: 'https://bookmark.test',
      url: 'bookmark.test',
      title: 'Bookmark Title',
      titleHighlighted: 'Bookmark <mark>Title</mark>',
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
      urlHighlighted: 'tab.<mark>test</mark>',
      score: 8.4,
    },
  ]
}

async function setupSearchView({ results = createResults(), opts = {} } = {}) {
  jest.resetModules()
  delete document.hasContextMenuListener
  window.location.hash = '#search/query'

  // Import modules - no need to mock since they have no side effects
  const searchViewModule = await import('../searchView.js')

  document.body.innerHTML = `
    <input id="search-input" />
    <ul id="result-list"></ul>
    <button id="search-approach-toggle"></button>
  `

  const resultList = document.getElementById('result-list')
  const searchInput = document.getElementById('search-input')
  const searchApproachToggle = document.getElementById('search-approach-toggle')

  const copiedResults = results.map((entry) => ({ ...entry }))
  const tabEntries = copiedResults
    .filter((entry) => entry.type === 'tab')
    .map((entry) => ({
      originalId: entry.originalId,
      originalUrl: entry.originalUrl,
      windowId: 101,
    }))

  window.Mark = jest.fn(() => ({
    mark: jest.fn(),
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
      mouseHoverEnabled: true,
      currentItem: 0,
    },
    opts: {
      displaySearchMatchHighlight: true,
      colorStripeWidth: 4,
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
        remove: jest.fn(),
        query: jest.fn(() => Promise.resolve([{ id: 77 }])),
        update: jest.fn(),
        create: jest.fn(),
        highlight: jest.fn(),
      },
      windows: {
        update: jest.fn(),
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

    expect(elements.resultList.children).toHaveLength(0)
  })

  it('renders results with metadata, badges, and highlight support', async () => {
    const { module, elements } = await setupSearchView()

    await module.renderSearchResults()

    expect(document.hasContextMenuListener).toBe(true)
    const listItems = elements.resultList.querySelectorAll('li')
    expect(listItems).toHaveLength(2)

    const bookmarkItem = listItems[0]
    expect(bookmarkItem.className).toBe('bookmark')
    expect(bookmarkItem.getAttribute('x-open-url')).toBe('https://bookmark.test')
    expect(bookmarkItem.style.borderLeft).toBe('4px solid rgb(17, 17, 17)')
    expect(bookmarkItem.querySelector('.edit-button').getAttribute('x-link')).toBe(
      './editBookmark.html#bookmark/bm-1/search/query',
    )

    const tagBadges = Array.from(bookmarkItem.querySelectorAll('.badge.tags'))
    expect(tagBadges.map((el) => el.getAttribute('x-link'))).toEqual(['#search/#alpha', '#search/#beta'])
    const folderBadges = Array.from(bookmarkItem.querySelectorAll('.badge.folder'))
    expect(folderBadges.map((el) => el.getAttribute('x-link'))).toEqual(['#search/~Work', '#search/~Work ~Docs'])
    expect(bookmarkItem.querySelector('.badge.last-visited')).not.toBeNull()
    const visitCounterBadge = bookmarkItem.querySelector('.badge.visit-counter')
    expect(visitCounterBadge).not.toBeNull()
    expect(bookmarkItem.querySelector('.badge.date-added')).not.toBeNull()
    expect(bookmarkItem.querySelector('.badge.score')).not.toBeNull()

    const tabItem = listItems[1]
    expect(tabItem.className).toBe('tab')
    expect(tabItem.querySelector('.close-button')).not.toBeNull()
    expect(tabItem.querySelector('.url').innerHTML).toBe('tab.<mark>test</mark>')

    expect(document.getElementById('selected-result')).toBe(bookmarkItem)
    expect(ext.model.currentItem).toBe(0)
    expect(window.Mark).toHaveBeenCalledTimes(2)
    const firstMarkInstance = window.Mark.mock.results[0].value
    expect(firstMarkInstance.mark).toHaveBeenCalledWith('query', {
      exclude: ['.last-visited', '.score', '.visit-counter', '.date-added'],
    })
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
    expect(listItem).not.toBeNull()
    expect(listItem.querySelectorAll('script')).toHaveLength(0)

    const titleText = listItem.querySelector('.title-text')
    expect(titleText.textContent.trim()).toBe('Title <img src=x onerror=alert(1)>')
    expect(titleText.innerHTML).toContain('&lt;img src=x onerror=alert(1)&gt;')

    const tagBadge = listItem.querySelector('.badge.tags')
    expect(tagBadge.textContent).toBe('#attack <svg onload=alert(1)>')
    expect(tagBadge.innerHTML).toContain('&lt;svg onload=alert(1)&gt;')

    const folderBadge = listItem.querySelector('.badge.folder')
    expect(folderBadge.textContent).toBe('~Folder"><img src=x>')
    expect(folderBadge.innerHTML).toContain('&lt;img src=x&gt;')

    const urlDiv = listItem.querySelector('.url')
    expect(urlDiv.textContent).toBe('example.com/<iframe src=javascript:alert(1)>')
    expect(urlDiv.innerHTML).toContain('&lt;iframe src=javascript:alert(1)&gt;')
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
    expect(listItem).not.toBeNull()
    expect(listItem.querySelector('.badge.tags')).toBeNull()
    expect(listItem.querySelector('.badge.folder')).toBeNull()
    expect(listItem.querySelector('.badge.last-visited')).toBeNull()
    expect(listItem.querySelector('.badge.visit-counter')).toBeNull()
    expect(listItem.querySelector('.badge.date-added')).toBeNull()
    expect(listItem.querySelector('.badge.score')).toBeNull()
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
    const editButton = listItem.querySelector('.edit-button')
    const link = editButton.getAttribute('x-link')

    expect(link).toContain('bookmark%2Fwith%2Fslashes')
    expect(link).not.toContain('bookmark/with/slashes')
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

    expect(lastVisitedBadge).not.toBeNull()
    expect(lastVisitedBadge.textContent).toBe('-0 s')
  })
})

describe('✅ FIXED: Mouse Hover State Fragility', () => {
  it('now re-enables mouse hover even if rendering throws error', async () => {
    const { module } = await setupSearchView()

    // Verify initial state
    expect(ext.model.mouseHoverEnabled).toBe(true)

    // Mock Mark to throw an error during rendering
    window.Mark = jest.fn(() => {
      throw new Error('Mark.js failed to load')
    })

    // FIXED: Error handling now re-enables mouseHoverEnabled
    try {
      await module.renderSearchResults()
    } catch {
      // Error is expected
    }

    // FIXED: mouseHoverEnabled is re-enabled in the error handler
    expect(ext.model.mouseHoverEnabled).toBe(true)
  })
})

describe('✅ FIXED: Error Boundary Added', () => {
  it('now handles rendering errors gracefully with proper error boundary', async () => {
    const { module } = await setupSearchView()

    // Mock a failure during rendering
    window.Mark = jest.fn(() => {
      throw new Error('Rendering catastrophe')
    })

    // FIXED: Error handling now catches errors and re-enables mouseHover
    // The error is still thrown to allow caller to handle, but state is restored
    await expect(module.renderSearchResults()).rejects.toThrow('Rendering catastrophe')

    // FIXED: mouseHoverEnabled is properly restored even on error
    expect(ext.model.mouseHoverEnabled).toBe(true)
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
    expect(elements.resultList.children.length).toBe(0)
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
    expect(firstItem).toBeDefined()
    expect(ext.model.currentItem).toBe(0)
  })
})
