/**
 * ✅ Covered behaviors: keyboard navigation (arrow keys, vim-style, Enter, Escape),
 *   selection management, scrolling, and hover handling.
 * ⚠️ Known gaps: does not verify browser navigation side effects beyond mocked APIs.
 * 🐞 Added BUG tests: none.
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

async function setupSearchNavigation({ results = createResults(), opts = {} } = {}) {
  jest.resetModules()
  window.location.hash = '#search/query'

  // Mock the searchEvents module to avoid circular dependencies
  jest.unstable_mockModule('../searchEvents.js', () => ({
    openResultItem: jest.fn(),
    setupResultItemsEvents: jest.fn(),
  }))

  // Import modules
  const searchNavigationModule = await import('../searchNavigation.js')
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
    module: searchNavigationModule,
    viewModule: searchViewModule,
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

describe('searchNavigation selection helpers', () => {
  it('selectListItem updates selection and scrolls when requested', async () => {
    const { module, viewModule, elements } = await setupSearchNavigation()
    await viewModule.renderSearchResults()

    const secondItem = elements.resultList.children[1]
    secondItem.scrollIntoView = jest.fn()

    module.selectListItem(1, true)

    expect(ext.model.currentItem).toBe(1)
    expect(document.getElementById('selected-result')).toBe(secondItem)
    expect(secondItem.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'auto',
      block: 'nearest',
    })
  })

  it('clearSelection removes the selected-result id', async () => {
    const { module, viewModule, elements } = await setupSearchNavigation()
    await viewModule.renderSearchResults()

    const firstItem = elements.resultList.children[0]
    expect(firstItem.id).toBe('selected-result')

    module.clearSelection()

    expect(document.getElementById('selected-result')).toBeNull()
    expect(firstItem.id).toBe('')
  })

  it('hoverResultItem delays activation until rendering completes, then selects index', async () => {
    const { module, viewModule, elements } = await setupSearchNavigation()
    await viewModule.renderSearchResults()
    const firstItem = elements.resultList.children[0]
    const secondItem = elements.resultList.children[1]

    module.hoverResultItem({ target: firstItem })
    expect(ext.model.mouseHoverEnabled).toBe(true)
    expect(ext.model.currentItem).toBe(0)

    module.hoverResultItem({ target: secondItem })
    expect(ext.model.currentItem).toBe('1')
    expect(document.getElementById('selected-result')).toBe(secondItem)
  })
})

describe('searchNavigation navigationKeyListener', () => {
  it('handles arrow navigation and prevents going above first item', async () => {
    const { module, viewModule, elements } = await setupSearchNavigation()
    await viewModule.renderSearchResults()
    const preventDefault = jest.fn()
    Array.from(elements.resultList.children).forEach((child) => {
      child.scrollIntoView = jest.fn()
    })

    elements.searchInput.value = 'typed'
    module.navigationKeyListener({
      key: 'ArrowUp',
      ctrlKey: false,
      preventDefault,
    })
    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(ext.model.currentItem).toBe(0)

    preventDefault.mockClear()
    module.navigationKeyListener({
      key: 'ArrowDown',
      ctrlKey: false,
      preventDefault,
    })
    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(ext.model.currentItem).toBe(1)
    expect(document.getElementById('selected-result')).toBe(elements.resultList.children[1])
  })

  it('supports vim-style navigation with Ctrl+P/Ctrl+N', async () => {
    const { module, viewModule, elements } = await setupSearchNavigation()
    await viewModule.renderSearchResults()
    const preventDefault = jest.fn()
    Array.from(elements.resultList.children).forEach((child) => {
      child.scrollIntoView = jest.fn()
    })

    // Ctrl+N moves down
    module.navigationKeyListener({
      key: 'n',
      ctrlKey: true,
      preventDefault,
    })
    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(ext.model.currentItem).toBe(1)

    preventDefault.mockClear()
    // Ctrl+P moves up
    module.navigationKeyListener({
      key: 'p',
      ctrlKey: true,
      preventDefault,
    })
    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(ext.model.currentItem).toBe(0)
  })

  it('supports vim-style navigation with Ctrl+K/Ctrl+J', async () => {
    const { module, viewModule, elements } = await setupSearchNavigation()
    await viewModule.renderSearchResults()
    const preventDefault = jest.fn()
    Array.from(elements.resultList.children).forEach((child) => {
      child.scrollIntoView = jest.fn()
    })

    // Ctrl+J moves down
    module.navigationKeyListener({
      key: 'j',
      ctrlKey: true,
      preventDefault,
    })
    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(ext.model.currentItem).toBe(1)

    preventDefault.mockClear()
    // Ctrl+K moves up
    module.navigationKeyListener({
      key: 'k',
      ctrlKey: true,
      preventDefault,
    })
    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(ext.model.currentItem).toBe(0)
  })

  it('handles Enter key to open selected result', async () => {
    const { module, viewModule } = await setupSearchNavigation()
    await viewModule.renderSearchResults()

    // Get the mocked openResultItem function
    const searchEventsModule = await import('../searchEvents.js')

    const event = {
      key: 'Enter',
      ctrlKey: true,
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
      button: 0,
      target: {
        nodeName: 'LI',
        getAttribute: () => null,
        className: '',
      },
    }
    window.location.hash = '#search/query'

    module.navigationKeyListener(event)

    expect(searchEventsModule.openResultItem).toHaveBeenCalledWith(event)
  })

  it('handles Escape key to reset search and focus input', async () => {
    const { module, viewModule, elements } = await setupSearchNavigation()
    await viewModule.renderSearchResults()

    const focusMock = jest.fn()
    elements.searchInput.focus = focusMock
    window.location.hash = '#search/query'

    module.navigationKeyListener({
      key: 'Escape',
      preventDefault: jest.fn(),
    })

    expect(window.location.hash).toBe('#search/')
    expect(focusMock).toHaveBeenCalledTimes(1)
  })
})
