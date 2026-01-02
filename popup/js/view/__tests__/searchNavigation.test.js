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

async function setupSearchNavigation({ results = createResults(), opts = {} } = {}) {
  jest.resetModules()
  window.location.hash = '#search/query'

  // Import modules - no mocking needed
  const searchNavigationModule = await import('../searchNavigation.js')
  const searchViewModule = await import('../searchView.js')
  const searchEventsModule = await import('../searchEvents.js')

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
    expect(document.getElementById('sel')).toBe(secondItem)
    expect(secondItem.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'auto',
      block: 'nearest',
    })
  })

  it('hoverResultItem only selects after mouse has actually moved', async () => {
    const { module, viewModule, elements } = await setupSearchNavigation()
    await viewModule.renderSearchResults()
    const firstItem = elements.resultList.children[0]
    const secondItem = elements.resultList.children[1]

    // Initially, mouseMoved is false (set by renderSearchResults)
    expect(ext.model.mouseMoved).toBe(false)

    // Hovering should not change selection when mouse hasn't moved
    module.hoverResultItem({ target: secondItem })
    expect(ext.model.currentItem).toBe(0)
    expect(document.getElementById('sel')).toBe(firstItem)

    // Simulate actual mouse movement
    ext.model.mouseMoved = true

    // Now hovering should update selection
    module.hoverResultItem({ target: secondItem })
    expect(ext.model.currentItem).toBe('1')
    expect(document.getElementById('sel')).toBe(secondItem)
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
    expect(document.getElementById('sel')).toBe(elements.resultList.children[1])
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
      module.navigationKeyListener({ ...keyCombo, preventDefault })
      expect(ext.model.currentItem).toBe(1)
    }

    // Test all vim-style up keybindings
    const upKeys = [
      { key: 'p', ctrlKey: true },
      { key: 'k', ctrlKey: true },
    ]
    for (const keyCombo of upKeys) {
      ext.model.currentItem = 1
      module.navigationKeyListener({ ...keyCombo, preventDefault })
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

  it('waits for in-flight search to complete before opening result on Enter', async () => {
    const { module, viewModule } = await setupSearchNavigation()
    await viewModule.renderSearchResults()

    // Mock window.close to verify openResultItem was called
    const windowCloseSpy = jest.fn()
    window.close = windowCloseSpy

    // Simulate an in-flight search by creating a pending promise
    let resolveSearch
    const searchPromise = new Promise((resolve) => {
      resolveSearch = resolve
    })
    ext.model.activeSearchPromise = searchPromise

    // Update the model with new results that will be available after search completes
    const newResults = [
      {
        type: 'bookmark',
        originalId: 'new-bm',
        originalUrl: 'https://new-result.test',
        url: 'new-result.test',
        title: 'New Search Result',
        score: 100,
      },
    ]

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

    // Start the navigation (it should wait for the search to complete)
    const navigationPromise = module.navigationKeyListener(event)

    // Verify that window.close hasn't been called yet (still waiting for search)
    expect(windowCloseSpy).not.toHaveBeenCalled()

    // Now complete the search and update results
    ext.model.result = newResults
    ext.model.currentItem = 0
    resolveSearch()

    // Wait for navigation to complete
    await navigationPromise

    // Now verify window closed (openResultItem was called with the correct result)
    expect(windowCloseSpy).toHaveBeenCalledTimes(1)
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
