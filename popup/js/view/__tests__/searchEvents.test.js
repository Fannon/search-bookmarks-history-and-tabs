/**
 * ✅ Covered behaviors: result opening flows (close, copy, modifiers, tab switching),
 *   and search approach toggling.
 * ⚠️ Known gaps: does not verify browser navigation side effects beyond mocked APIs.
 * 🐞 Added BUG tests: none.
 */

import { jest } from '@jest/globals'

const originalWindowClose = window.close
const originalWindowOpen = window.open
const originalClipboard = navigator.clipboard

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

async function setupSearchEvents({ results = createResults(), opts = {} } = {}) {
  jest.resetModules()
  window.location.hash = '#search/query'

  const getUserOptions = jest.fn(async () => ({ searchStrategy: 'precise' }))
  const setUserOptions = jest.fn(async () => {})
  const searchMock = jest.fn(() => Promise.resolve())

  jest.unstable_mockModule('../../model/options.js', () => ({
    getUserOptions,
    setUserOptions,
  }))
  jest.unstable_mockModule('../../search/common.js', () => ({
    search: searchMock,
  }))

  // Import modules needed for events
  const searchEventsModule = await import('../searchEvents.js')
  const searchViewModule = await import('../searchView.js')
  const searchNavigationModule = await import('../searchNavigation.js')

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

  navigator.clipboard = {
    writeText: jest.fn(() => Promise.resolve()),
  }
  window.Mark = jest.fn(() => ({
    mark: jest.fn(),
  }))
  window.close = jest.fn()
  window.open = jest.fn()

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
    module: searchEventsModule,
    viewModule: searchViewModule,
    navigationModule: searchNavigationModule,
    mocks: {
      getUserOptions,
      setUserOptions,
      search: searchMock,
    },
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
  navigator.clipboard = originalClipboard
  window.close = originalWindowClose
  window.open = originalWindowOpen
  document.body.innerHTML = ''
  window.location.hash = ''
})

describe('searchEvents openResultItem', () => {
  it('copies URL to clipboard on right click', async () => {
    const { module, viewModule } = await setupSearchEvents()
    await viewModule.renderSearchResults()
    const selected = document.getElementById('selected-result')

    module.openResultItem({
      button: 2,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      target: {
        nodeName: 'LI',
        getAttribute: () => null,
        className: '',
      },
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    })

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(selected.getAttribute('x-open-url'))
  })

  it('closes tabs from the result list when the close button is pressed', async () => {
    const { viewModule, elements } = await setupSearchEvents()
    await viewModule.renderSearchResults()
    const tabItem = elements.resultList.children[1]
    const closeButton = tabItem.querySelector('.close-button')

    closeButton.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))

    expect(ext.browserApi.tabs.remove).toHaveBeenCalledWith(2)
    expect(ext.model.tabs).toHaveLength(0)
    expect(ext.model.result).toHaveLength(1)
    expect(elements.resultList.children).toHaveLength(1)
  })

  it('opens URLs in the current tab when shift is held and closes the popup afterward', async () => {
    const { module, viewModule } = await setupSearchEvents()
    await viewModule.renderSearchResults()

    module.openResultItem({
      button: 0,
      shiftKey: true,
      altKey: false,
      ctrlKey: false,
      target: {
        nodeName: 'LI',
        getAttribute: () => null,
        className: '',
      },
      stopPropagation: jest.fn(),
      preventDefault: jest.fn(),
    })
    await Promise.resolve()

    expect(ext.browserApi.tabs.query).toHaveBeenCalledTimes(1)
    expect(ext.browserApi.tabs.update).toHaveBeenCalledWith(77, { url: 'https://bookmark.test' })
    expect(window.close).toHaveBeenCalledTimes(1)
  })

  it('opens URLs in a background tab when ctrl is held', async () => {
    const { module, viewModule } = await setupSearchEvents()
    await viewModule.renderSearchResults()

    module.openResultItem({
      button: 0,
      ctrlKey: true,
      shiftKey: false,
      altKey: false,
      target: {
        nodeName: 'LI',
        getAttribute: () => null,
        className: '',
      },
      stopPropagation: jest.fn(),
      preventDefault: jest.fn(),
    })

    expect(ext.browserApi.tabs.create).toHaveBeenCalledWith({
      active: false,
      url: 'https://bookmark.test',
    })
  })

  it('switches to an existing tab when a matching tab is found', async () => {
    const { module, viewModule, navigationModule } = await setupSearchEvents()
    await viewModule.renderSearchResults()
    // Select the tab item (index 1)
    navigationModule.selectListItem(1)

    module.openResultItem({
      button: 0,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      target: {
        nodeName: 'LI',
        getAttribute: () => null,
        className: '',
      },
      stopPropagation: jest.fn(),
      preventDefault: jest.fn(),
    })

    expect(ext.browserApi.tabs.update).toHaveBeenCalledWith(2, { active: true })
    expect(ext.browserApi.windows.update).toHaveBeenCalledWith(101, { focused: true })
    expect(window.close).toHaveBeenCalledTimes(1)
  })

  it('opens a new active tab when no matching tab exists', async () => {
    const { module, viewModule } = await setupSearchEvents()
    await viewModule.renderSearchResults()
    ext.model.tabs = []

    module.openResultItem({
      button: 0,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      target: {
        nodeName: 'LI',
        getAttribute: () => null,
        className: '',
      },
      stopPropagation: jest.fn(),
      preventDefault: jest.fn(),
    })

    expect(ext.browserApi.tabs.create).toHaveBeenCalledWith({
      active: true,
      url: 'https://bookmark.test',
    })
    expect(window.close).toHaveBeenCalledTimes(1)
  })

  it('falls back to window.open when no browser tab APIs are available', async () => {
    const { module, viewModule } = await setupSearchEvents()
    await viewModule.renderSearchResults()
    delete ext.browserApi.tabs

    module.openResultItem({
      button: 0,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      target: {
        nodeName: 'LI',
        getAttribute: () => null,
        className: '',
      },
      stopPropagation: jest.fn(),
      preventDefault: jest.fn(),
    })

    expect(window.open).toHaveBeenCalledWith('https://bookmark.test', '_newtab')
  })
})

describe('search approach controls', () => {
  it('toggles between precise and fuzzy search strategies', async () => {
    const { module, mocks, elements } = await setupSearchEvents()
    ext.opts.searchStrategy = 'precise'

    await module.toggleSearchApproach()

    expect(ext.opts.searchStrategy).toBe('fuzzy')
    expect(mocks.getUserOptions).toHaveBeenCalledTimes(1)
    expect(mocks.setUserOptions).toHaveBeenCalledWith({ searchStrategy: 'fuzzy' })
    expect(elements.searchApproachToggle.innerText).toBe('FUZZY')
    expect(elements.searchApproachToggle.className).toBe('fuzzy')
    expect(mocks.search).toHaveBeenCalledTimes(1)
  })

  it('updateSearchApproachToggle reflects current strategy', async () => {
    const { module, elements } = await setupSearchEvents()
    ext.opts.searchStrategy = 'precise'
    module.updateSearchApproachToggle()
    expect(elements.searchApproachToggle.innerText).toBe('PRECISE')
    expect(elements.searchApproachToggle.className).toBe('precise')

    ext.opts.searchStrategy = 'fuzzy'
    module.updateSearchApproachToggle()
    expect(elements.searchApproachToggle.innerText).toBe('FUZZY')
    expect(elements.searchApproachToggle.className).toBe('fuzzy')
  })
})
