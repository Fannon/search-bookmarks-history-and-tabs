import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import { clearTestExt, flushPromises } from './testUtils.js'

const setupDom = () => {
  document.body.innerHTML = `
    <input id="q" />
    <ul id="results"></ul>
    <span id="counter"></span>
    <button id="toggle"></button>
    <div id="results-load"></div>
    <div id="tags-view"></div>
    <div id="folders-view"></div>
    <div id="errors"></div>
  `
  window.location.hash = ''
}

const mockDependencies = async (overrides = {}) => {
  const defaults = {
    loadScript: jest.fn(() => Promise.resolve()),
    printError: jest.fn(),
    getEffectiveOptions: jest.fn(() =>
      Promise.resolve({
        searchStrategy: 'precise',
        debug: false,
        enableTabs: true,
        enableBookmarks: true,
        enableHistory: true,
        maxRecentTabsToShow: 5,
      }),
    ),
    getSearchData: jest.fn(() =>
      Promise.resolve({
        tabs: [{ originalId: 't1' }],
        bookmarks: [{ originalId: 'b1' }],
        history: [{ originalId: 'h1' }],
      }),
    ),
    addDefaultEntries: jest.fn(async () => {
      const defaults = [{ originalId: 'default' }]
      if (globalThis.ext?.model) {
        globalThis.ext.model.result = defaults
      }
      return defaults
    }),
    renderSearchResults: jest.fn(),
    search: jest.fn(() => Promise.resolve()),
  }
  const config = { ...defaults, ...overrides }

  await jest.unstable_mockModule('../helper/utils.js', () => ({
    __esModule: true,
    loadScript: config.loadScript,
  }))
  await jest.unstable_mockModule('../view/errorView.js', () => ({
    __esModule: true,
    closeErrors: () => {
      const element = document.getElementById('errors')
      if (element) {
        element.style = 'display: none;'
      }
    },
    printError: config.printError,
  }))
  await jest.unstable_mockModule('../model/options.js', () => ({
    __esModule: true,
    getEffectiveOptions: config.getEffectiveOptions,
    getUserOptions: jest.fn(() => Promise.resolve({ searchStrategy: 'precise' })),
    setUserOptions: jest.fn(() => Promise.resolve()),
  }))
  await jest.unstable_mockModule('../model/searchData.js', () => ({
    __esModule: true,
    getSearchData: config.getSearchData,
  }))
  await jest.unstable_mockModule('../search/common.js', () => ({
    __esModule: true,
    search: config.search,
    addDefaultEntries: config.addDefaultEntries,
  }))
  await jest.unstable_mockModule('../helper/browserApi.js', () => ({
    __esModule: true,
    browserApi: {},
  }))
  await jest.unstable_mockModule('../view/searchView.js', () => ({
    __esModule: true,
    renderSearchResults: config.renderSearchResults,
  }))
  await jest.unstable_mockModule('../view/searchNavigation.js', () => ({
    __esModule: true,
    navigationKeyListener: jest.fn(),
    hoverResultItem: jest.fn(),
    clearSelection: jest.fn(),
    selectListItem: jest.fn(),
  }))
  await jest.unstable_mockModule('../view/searchEvents.js', () => ({
    __esModule: true,
    toggleSearchApproach: jest.fn(),
    updateSearchApproachToggle: jest.fn(),
    openResultItem: jest.fn(),
    setupResultItemsEvents: jest.fn(),
  }))

  return config
}

describe('initSearch entry point', () => {
  let moduleUnderTest

  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    clearTestExt()
    setupDom()
    moduleUnderTest = null
  })

  afterEach(() => {
    if (moduleUnderTest) {
      window.removeEventListener('hashchange', moduleUnderTest.hashRouter)
    }
    clearTestExt()
    moduleUnderTest = null
  })

  test('initExtension populates ext namespace and renders defaults', async () => {
    const mocks = await mockDependencies()

    const module = await import('../initSearch.js')
    moduleUnderTest = module
    await flushPromises()

    expect(module.ext.initialized).toBe(true)
    expect(module.ext.model.tabs).toEqual([{ originalId: 't1' }])
    expect(module.ext.searchCache instanceof Map).toBe(true)
    expect(mocks.addDefaultEntries).toHaveBeenCalled()
    expect(mocks.renderSearchResults).toHaveBeenCalled()
    expect(document.getElementById('results-load')).toBeNull()
  })

  test('hashRouter handles search, bookmark routes, and ignores tags/folders routes', async () => {
    const mocks = await mockDependencies()
    const module = await import('../initSearch.js')
    moduleUnderTest = module
    await flushPromises()

    window.removeEventListener('hashchange', module.hashRouter)
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    try {
      window.location.hash = '#search/test%20query'
      await module.hashRouter()
      expect(module.ext.dom.searchInput.value).toBe('test query')
      expect(mocks.search).toHaveBeenCalled()

      const searchCallsAfterSearchRoute = mocks.search.mock.calls.length

      window.history.replaceState(null, '', 'http://localhost/')
      window.location.hash = '#bookmark/123'
      await module.hashRouter()
      expect(window.location.href).toBe('http://localhost/#bookmark/123')
      expect(mocks.search.mock.calls.length).toBe(searchCallsAfterSearchRoute)

      window.history.replaceState(null, '', 'http://localhost/')
      window.location.hash = '#bookmark/999'
      await module.hashRouter()
      expect(window.location.href).toBe('http://localhost/#bookmark/999')
      expect(mocks.search.mock.calls.length).toBe(searchCallsAfterSearchRoute)
    } finally {
      window.history.replaceState(null, '', 'http://localhost/')
      warnSpy.mockRestore()
    }
  })

  test('search input triggers search immediately on each input event', async () => {
    const searchMock = jest.fn()
    const mocks = await mockDependencies({
      search: searchMock,
    })

    const module = await import('../initSearch.js')
    moduleUnderTest = module
    await flushPromises()

    const firstInput = new Event('input')
    const secondInput = new Event('input')

    module.ext.dom.searchInput.value = 'first'
    module.ext.dom.searchInput.dispatchEvent(firstInput)
    module.ext.dom.searchInput.value = 'second'
    module.ext.dom.searchInput.dispatchEvent(secondInput)

    expect(mocks.search).toHaveBeenCalledTimes(2)
    expect(mocks.search).toHaveBeenNthCalledWith(1, firstInput)
    expect(mocks.search).toHaveBeenNthCalledWith(2, secondInput)
  })

  test('closeErrors hides overlay containers', async () => {
    await mockDependencies()
    const module = await import('../initSearch.js')
    moduleUnderTest = module
    await flushPromises()

    document.getElementById('errors').style = ''
    document.getElementById('tags-view').style = ''
    document.getElementById('folders-view').style = ''

    module.closeErrors()

    expect(document.getElementById('errors').style.cssText).toBe('display: none;')
    expect(document.getElementById('tags-view').style.cssText).toBe('')
    expect(document.getElementById('folders-view').style.cssText).toBe('')
  })
})
