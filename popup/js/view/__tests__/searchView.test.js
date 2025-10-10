/**
 * ✅ Covered behaviors: rendering of search results, navigation interactions, hover handling,
 *   result opening flows (close, copy, modifiers, tab switching), and search approach toggling.
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

async function setupSearchView({ results = createResults(), opts = {} } = {}) {
  jest.resetModules()
  delete document.hasContextMenuListener

  const timeSince = jest.fn(() => '1 hour ago')
  const getUserOptions = jest.fn(async () => ({ searchStrategy: 'precise' }))
  const setUserOptions = jest.fn(async () => {})
  const searchMock = jest.fn(() => Promise.resolve())

  jest.unstable_mockModule('../../helper/utils.js', () => ({
    timeSince,
  }))
  jest.unstable_mockModule('../../model/options.js', () => ({
    getUserOptions,
    setUserOptions,
  }))
  jest.unstable_mockModule('../../search/common.js', () => ({
    search: searchMock,
  }))

  const module = await import('../searchView.js')

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
    module,
    mocks: {
      timeSince,
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
})

describe('searchView renderSearchResults', () => {
  it('clears the list when no results are provided', async () => {
    const { module, elements } = await setupSearchView({ results: [] })
    elements.resultList.innerHTML = '<li>stale item</li>'

    await module.renderSearchResults([])

    expect(elements.resultList.children).toHaveLength(0)
  })

  it('renders results with metadata, badges, and highlight support', async () => {
    const { module, elements, mocks } = await setupSearchView()

    await module.renderSearchResults()

    expect(document.hasContextMenuListener).toBe(true)
    const listItems = elements.resultList.querySelectorAll('li')
    expect(listItems).toHaveLength(2)

    const bookmarkItem = listItems[0]
    expect(bookmarkItem.className).toBe('bookmark')
    expect(bookmarkItem.getAttribute('x-open-url')).toBe('https://bookmark.test')
    expect(bookmarkItem.style.borderLeft).toBe('4px solid rgb(17, 17, 17)')
    expect(bookmarkItem.querySelector('.edit-button').getAttribute('x-link')).toBe('#edit-bookmark/bm-1')

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
    expect(mocks.timeSince).toHaveBeenCalledTimes(1)
    expect(window.Mark).toHaveBeenCalledTimes(2)
    const firstMarkInstance = window.Mark.mock.results[0].value
    expect(firstMarkInstance.mark).toHaveBeenCalledWith('query')
  })
})

describe('searchView selection helpers', () => {
  it('selectListItem updates selection and scrolls when requested', async () => {
    const { module, elements } = await setupSearchView()
    await module.renderSearchResults()

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
    const { module, elements } = await setupSearchView()
    await module.renderSearchResults()
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

describe('searchView navigationKeyListener', () => {
  it('handles arrow navigation, enter activation, and escape reset', async () => {
    const { module, elements } = await setupSearchView()
    await module.renderSearchResults()
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

    const openPreventDefault = jest.fn()
    const openStop = jest.fn()
    window.location.hash = '#search/query'
    module.navigationKeyListener({
      key: 'Enter',
      ctrlKey: true,
      preventDefault: openPreventDefault,
      stopPropagation: openStop,
      button: 0,
      target: {
        nodeName: 'LI',
        getAttribute: () => null,
        className: '',
      },
    })
    expect(ext.browserApi.tabs.create).toHaveBeenCalledWith({
      active: false,
      url: 'https://tab.test',
    })

    const focusMock = jest.fn()
    elements.searchInput.focus = focusMock
    module.navigationKeyListener({
      key: 'Escape',
      preventDefault: jest.fn(),
    })
    expect(window.location.hash).toBe('#search/')
    expect(focusMock).toHaveBeenCalledTimes(1)
  })
})

describe('searchView openResultItem', () => {
  it('copies URL to clipboard on right click', async () => {
    const { module } = await setupSearchView()
    await module.renderSearchResults()
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
    const { module, elements } = await setupSearchView()
    await module.renderSearchResults()
    module.selectListItem(1)
    const tabItem = elements.resultList.children[1]
    const closeButton = tabItem.querySelector('.close-button')

    closeButton.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))

    expect(ext.browserApi.tabs.remove).toHaveBeenCalledWith(2)
    expect(ext.model.tabs).toHaveLength(0)
    expect(ext.model.result).toHaveLength(1)
    expect(elements.resultList.children).toHaveLength(1)
  })

  it('opens URLs in the current tab when shift is held and closes the popup afterward', async () => {
    const { module } = await setupSearchView()
    await module.renderSearchResults()

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
    const { module } = await setupSearchView()
    await module.renderSearchResults()

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
    const { module } = await setupSearchView()
    await module.renderSearchResults()
    module.selectListItem(1)

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
    const { module } = await setupSearchView()
    await module.renderSearchResults()
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
    const { module } = await setupSearchView()
    await module.renderSearchResults()
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
    const { module, mocks, elements } = await setupSearchView()
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
    const { module, elements } = await setupSearchView()
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
