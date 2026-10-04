import '../../../test/setup.js'
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, mock, test } from 'node:test'
import { resetModules } from '../../../test/modules.js'
import { matches } from '../../../test/patterns.js'
import { clearTestExt, flushPromises } from './testUtils.js'

const setupDom = () => {
  document.head.innerHTML = ''
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
    loadScript: mock.fn(() => Promise.resolve()),
    printError: mock.fn(),
    getEffectiveOptions: mock.fn(() =>
      Promise.resolve({
        searchStrategy: 'precise',
        debug: false,
        enableTabs: true,
        enableBookmarks: true,
        enableHistory: true,
        maxRecentTabsToShow: 5,
      }),
    ),
    getSearchData: mock.fn(() =>
      Promise.resolve({
        tabs: [{ originalId: 't1' }],
        bookmarks: [{ originalId: 'b1' }],
        history: [{ originalId: 'h1' }],
      }),
    ),
    addDefaultEntries: mock.fn(async () => {
      const defaults = [{ originalId: 'default' }]
      if (globalThis.ext?.model) {
        globalThis.ext.model.result = defaults
      }
      return defaults
    }),
    renderSearchResults: mock.fn(),
    search: mock.fn(() => Promise.resolve()),
  }
  const config = { ...defaults, ...overrides }
  mock.module(new URL('../helper/utils.js', import.meta.url), {
    exports: {
      loadScript: config.loadScript,
    },
  })
  mock.module(new URL('../view/errorView.js', import.meta.url), {
    exports: {
      closeErrors: () => {
        const element = document.getElementById('errors')
        if (element) {
          element.style = 'display: none;'
        }
      },
      printError: config.printError,
    },
  })
  mock.module(new URL('../model/optionsStorage.js', import.meta.url), {
    exports: {
      getEffectiveOptions: config.getEffectiveOptions,
      getUserOptions: mock.fn(() => Promise.resolve({ searchStrategy: 'precise' })),
      setUserOptions: mock.fn(() => Promise.resolve()),
    },
  })
  mock.module(new URL('../model/searchData.js', import.meta.url), {
    exports: {
      getSearchData: config.getSearchData,
    },
  })
  mock.module(new URL('../search/common.js', import.meta.url), {
    exports: {
      search: config.search,
      addDefaultEntries: config.addDefaultEntries,
    },
  })
  mock.module(new URL('../helper/browserApi.js', import.meta.url), {
    exports: {
      browserApi: {},
    },
  })
  mock.module(new URL('../view/searchView.js', import.meta.url), {
    exports: {
      renderSearchResults: config.renderSearchResults,
    },
  })
  mock.module(new URL('../view/searchNavigation.js', import.meta.url), {
    exports: {
      navigationKeyListener: mock.fn(),
      hoverResultItem: mock.fn(),
      clearSelection: mock.fn(),
      selectListItem: mock.fn(),
    },
  })
  mock.module(new URL('../view/searchEvents.js', import.meta.url), {
    exports: {
      toggleSearchApproach: mock.fn(),
      updateSearchApproachToggle: mock.fn(),
      openResultItem: mock.fn(),
      setupResultItemsEvents: mock.fn(),
    },
  })
  return config
}
const createDeferred = () => {
  let resolve
  const promise = new Promise((promiseResolve) => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}
describe('initSearch entry point', () => {
  let moduleUnderTest
  beforeEach(() => {
    resetModules()
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
    assert.strictEqual(module.ext.initialized, true)
    assert.deepStrictEqual(module.ext.model.tabs, [{ originalId: 't1' }])
    assert.strictEqual(module.ext.searchCache instanceof Map, true)
    assert(mocks.addDefaultEntries.mock.callCount() > 0)
    assert(mocks.renderSearchResults.mock.callCount() > 0)
    assert.strictEqual(document.getElementById('results-load'), null)
  })
  test('initExtension does not inject a separate favicon stylesheet', async () => {
    await mockDependencies()
    const module = await import('../initSearch.js')
    moduleUnderTest = module
    await flushPromises()
    assert.strictEqual(document.querySelector('link[href*="favicons"]'), null)
  })
  test('initExtension keeps favicon styles in the shared stylesheet when favicons are enabled', async () => {
    document.head.innerHTML = '<link rel="stylesheet" href="./css/style.min.css">'
    await mockDependencies({
      getEffectiveOptions: mock.fn(() =>
        Promise.resolve({
          displayFavicons: true,
        }),
      ),
    })
    const module = await import('../initSearch.js')
    moduleUnderTest = module
    await flushPromises()
    assert.strictEqual(document.querySelector('link[href*="favicons"]'), null)
  })
  test('initExtension keeps loading indicator until default route rendering completes', async () => {
    const defaultEntries = createDeferred()
    const mocks = await mockDependencies({
      addDefaultEntries: mock.fn(() => defaultEntries.promise),
    })
    const module = await import('../initSearch.js')
    moduleUnderTest = module
    await flushPromises()
    assert(mocks.addDefaultEntries.mock.callCount() > 0)
    assert(mocks.renderSearchResults.mock.callCount() === 0)
    assert.notStrictEqual(document.getElementById('results-load'), null)
    defaultEntries.resolve([{ originalId: 'default' }])
    await flushPromises()
    assert(mocks.renderSearchResults.mock.callCount() > 0)
    assert.strictEqual(document.getElementById('results-load'), null)
  })
  test('initExtension keeps loading indicator until hash-driven search completes', async () => {
    const search = createDeferred()
    const mocks = await mockDependencies({
      search: mock.fn(() => search.promise),
    })
    window.location.hash = '#search/test'
    const module = await import('../initSearch.js')
    moduleUnderTest = module
    await flushPromises()
    assert(mocks.search.mock.calls.some((call) => matches(call.arguments, [{ bypassInitializedGuard: true }])))
    assert.notStrictEqual(document.getElementById('results-load'), null)
    search.resolve()
    await flushPromises()
    assert.strictEqual(document.getElementById('results-load'), null)
  })
  test('initExtension surfaces async hashRouter failures through the initialization catch', async () => {
    const routeError = new Error('Default entries failed')
    const mocks = await mockDependencies()
    const module = await import('../initSearch.js')
    moduleUnderTest = module
    await flushPromises()
    setupDom()
    mocks.printError.mock.resetCalls()
    mocks.addDefaultEntries.mock.mockImplementationOnce(() => Promise.reject(routeError))
    module.ext.initialized = false
    await module.initExtension().catch((err) => {
      mocks.printError(err, 'Could not initialize Extension')
    })
    assert(
      mocks.printError.mock.calls.some((call) =>
        matches(call.arguments, [routeError, 'Could not initialize Extension']),
      ),
    )
    assert.strictEqual(module.ext.initialized, false)
    assert.strictEqual(document.getElementById('results-load'), null)
  })
  test('initExtension removes loading indicator when search data loading fails', async () => {
    const dataError = new Error('Search data failed')
    const mocks = await mockDependencies({
      getSearchData: mock.fn(() => Promise.reject(dataError)),
    })
    const module = await import('../initSearch.js')
    moduleUnderTest = module
    await flushPromises()
    assert(
      mocks.printError.mock.calls.some((call) =>
        matches(call.arguments, [dataError, 'Could not initialize Extension']),
      ),
    )
    assert.strictEqual(document.getElementById('results-load'), null)
  })
  test('hashRouter handles search, bookmark routes, and ignores tags/folders routes', async () => {
    const mocks = await mockDependencies()
    const module = await import('../initSearch.js')
    moduleUnderTest = module
    await flushPromises()
    window.removeEventListener('hashchange', module.hashRouter)
    const warnSpy = mock.method(console, 'warn', () => {})
    try {
      window.location.hash = '#search/test%20query'
      await module.hashRouter()
      assert.strictEqual(module.ext.dom.searchInput.value, 'test query')
      assert(mocks.search.mock.callCount() > 0)
      const searchCallsAfterSearchRoute = mocks.search.mock.calls.length
      window.history.replaceState(null, '', 'http://localhost/')
      window.location.hash = '#bookmark/123'
      await module.hashRouter()
      assert.strictEqual(window.location.href, 'http://localhost/#bookmark/123')
      assert.strictEqual(mocks.search.mock.calls.length, searchCallsAfterSearchRoute)
      window.history.replaceState(null, '', 'http://localhost/')
      window.location.hash = '#bookmark/999'
      await module.hashRouter()
      assert.strictEqual(window.location.href, 'http://localhost/#bookmark/999')
      assert.strictEqual(mocks.search.mock.calls.length, searchCallsAfterSearchRoute)
    } finally {
      window.history.replaceState(null, '', 'http://localhost/')
      warnSpy.mock.restore()
    }
  })
  test('search input triggers search immediately on each input event', async () => {
    const searchMock = mock.fn()
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
    assert.strictEqual(mocks.search.mock.callCount(), 2)
    assert(matches(mocks.search.mock.calls[0].arguments, [firstInput]))
    assert(matches(mocks.search.mock.calls[1].arguments, [secondInput]))
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
    assert.strictEqual(document.getElementById('errors').style.cssText, 'display: none;')
    assert.strictEqual(document.getElementById('tags-view').style.cssText, '')
    assert.strictEqual(document.getElementById('folders-view').style.cssText, '')
  })
})
