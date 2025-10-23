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

  // Import modules - no mocking needed
  const searchNavigationModule = await import('../searchNavigation.js')
  const searchViewModule = await import('../searchView.js')
  const searchEventsModule = await import('../searchEvents.js')

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
      searchDebounce: {
        timeoutId: null,
        isPending: false,
      },
      flushPendingSearch: jest.fn(() => Promise.resolve(false)),
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
    eventsModule: searchEventsModule,
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
    await module.navigationKeyListener({
      key: 'ArrowUp',
      ctrlKey: false,
      preventDefault,
    })
    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(ext.model.currentItem).toBe(0)

    preventDefault.mockClear()
    await module.navigationKeyListener({
      key: 'ArrowDown',
      ctrlKey: false,
      preventDefault,
    })
    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(ext.model.currentItem).toBe(1)
    expect(document.getElementById('selected-result')).toBe(elements.resultList.children[1])
  })

  it('supports vim-style navigation keybindings', async () => {
    const { module, viewModule, elements } = await setupSearchNavigation()
    await viewModule.renderSearchResults()
    const preventDefault = jest.fn()
    Array.from(elements.resultList.children).forEach((child) => {
      child.scrollIntoView = jest.fn()
    })

    // Test all vim-style down keybindings
    const downKeys = [
      { key: 'n', ctrlKey: true },
      { key: 'j', ctrlKey: true },
    ]
    for (const keyCombo of downKeys) {
      ext.model.currentItem = 0
      await module.navigationKeyListener({ ...keyCombo, preventDefault })
      expect(ext.model.currentItem).toBe(1)
    }

    // Test all vim-style up keybindings
    const upKeys = [
      { key: 'p', ctrlKey: true },
      { key: 'k', ctrlKey: true },
    ]
    for (const keyCombo of upKeys) {
      ext.model.currentItem = 1
      await module.navigationKeyListener({ ...keyCombo, preventDefault })
      expect(ext.model.currentItem).toBe(0)
    }
  })

  it('handles Enter key by calling openResultItem', async () => {
    const { module, viewModule } = await setupSearchNavigation()
    await viewModule.renderSearchResults()

    // Mock window.close to verify openResultItem was called (it closes the window)
    const windowCloseSpy = jest.fn()
    window.close = windowCloseSpy

    const event = {
      key: 'Enter',
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
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

    await module.navigationKeyListener(event)

    // Verify window closed (side effect of openResultItem for bookmark)
    expect(windowCloseSpy).toHaveBeenCalledTimes(1)
  })

  it('flushes pending search work before opening result on Enter', async () => {
    const { module, viewModule } = await setupSearchNavigation()
    await viewModule.renderSearchResults()

    const newResults = [
      {
        type: 'bookmark',
        originalId: 'fresh-1',
        originalUrl: 'https://fresh.example',
        url: 'fresh.example',
        title: 'Fresh Result',
        score: 99,
      },
    ]

    const flushSpy = jest.fn(async () => {
      ext.model.result = newResults
      await viewModule.renderSearchResults(newResults)
      return true
    })
    ext.model.flushPendingSearch = flushSpy

    const windowCloseSpy = jest.fn()
    window.close = windowCloseSpy

    const event = {
      key: 'Enter',
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
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

    await module.navigationKeyListener(event)

    expect(flushSpy).toHaveBeenCalledTimes(1)
    expect(windowCloseSpy).toHaveBeenCalledTimes(1)
    const selectedResult = document.getElementById('selected-result')
    expect(selectedResult).not.toBeNull()
    expect(selectedResult.getAttribute('x-open-url')).toBe('https://fresh.example')
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
