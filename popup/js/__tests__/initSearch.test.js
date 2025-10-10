import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import { flushPromises, clearTestExt } from './testUtils.js'

const setupDom = () => {
  document.body.innerHTML = `
    <input id="search-input" />
    <ul id="result-list"></ul>
    <span id="result-counter"></span>
    <button id="search-approach-toggle"></button>
    <div id="results-loading"></div>
    <div id="edit-bookmark"></div>
    <div id="tags-overview"></div>
    <div id="folders-overview"></div>
    <div id="error-list"></div>
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
        searchDebounceMs: 10,
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
    editBookmark: jest.fn(() => Promise.resolve()),
    updateBookmark: jest.fn(),
    loadFoldersOverview: jest.fn(),
    loadTagsOverview: jest.fn(),
  }
  const config = { ...defaults, ...overrides }

  await jest.unstable_mockModule('../helper/utils.js', () => ({
    __esModule: true,
    loadScript: config.loadScript,
    printError: config.printError,
  }))
  await jest.unstable_mockModule('../model/options.js', () => ({
    __esModule: true,
    getEffectiveOptions: config.getEffectiveOptions,
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
  await jest.unstable_mockModule('../view/editBookmarkView.js', () => ({
    __esModule: true,
    editBookmark: config.editBookmark,
    updateBookmark: config.updateBookmark,
  }))
  await jest.unstable_mockModule('../view/foldersView.js', () => ({
    __esModule: true,
    loadFoldersOverview: config.loadFoldersOverview,
  }))
  await jest.unstable_mockModule('../helper/browserApi.js', () => ({
    __esModule: true,
    browserApi: {},
  }))
  await jest.unstable_mockModule('../view/searchView.js', () => ({
    __esModule: true,
    renderSearchResults: config.renderSearchResults,
    navigationKeyListener: jest.fn(),
    toggleSearchApproach: jest.fn(),
    updateSearchApproachToggle: jest.fn(),
  }))
  await jest.unstable_mockModule('../view/tagsView.js', () => ({
    __esModule: true,
    loadTagsOverview: config.loadTagsOverview,
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
    expect(mocks.loadScript).toHaveBeenCalledWith('./lib/mark.es6.min.js')
    expect(document.getElementById('results-loading')).toBeNull()
  })

  test('hashRouter handles search, tags, folders and bookmark routes', async () => {
    const mocks = await mockDependencies()
    const module = await import('../initSearch.js')
    moduleUnderTest = module
    await flushPromises()

    window.removeEventListener('hashchange', module.hashRouter)

    window.location.hash = '#search/test%20query'
    await module.hashRouter()
    expect(module.ext.dom.searchInput.value).toBe('test query')
    expect(mocks.search).toHaveBeenCalled()

    const searchCallsAfterSearchRoute = mocks.search.mock.calls.length

    window.location.hash = '#tags/'
    await module.hashRouter()
    expect(mocks.loadTagsOverview).toHaveBeenCalled()
    expect(mocks.search.mock.calls.length).toBe(searchCallsAfterSearchRoute)

    window.location.hash = '#folders/'
    await module.hashRouter()
    expect(mocks.loadFoldersOverview).toHaveBeenCalled()
    expect(mocks.search.mock.calls.length).toBe(searchCallsAfterSearchRoute)

    window.location.hash = '#edit-bookmark/123'
    await module.hashRouter()
    expect(mocks.editBookmark).toHaveBeenCalledWith('123')
    expect(mocks.search.mock.calls.length).toBe(searchCallsAfterSearchRoute)

    window.location.hash = '#update-bookmark/999'
    await module.hashRouter()
    expect(mocks.updateBookmark).toHaveBeenCalledWith('999')
    expect(mocks.search.mock.calls.length).toBe(searchCallsAfterSearchRoute)
  })

  test('closeModals hides overlay containers', async () => {
    await mockDependencies()
    const module = await import('../initSearch.js')
    moduleUnderTest = module
    await flushPromises()

    document.getElementById('edit-bookmark').style = ''
    document.getElementById('tags-overview').style = ''
    document.getElementById('folders-overview').style = ''
    document.getElementById('error-list').style = ''

    module.closeModals()

    expect(document.getElementById('edit-bookmark').style.cssText).toBe('display: none;')
    expect(document.getElementById('tags-overview').style.cssText).toBe('display: none;')
    expect(document.getElementById('folders-overview').style.cssText).toBe('display: none;')
    expect(document.getElementById('error-list').style.cssText).toBe('display: none;')
  })
})
