import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { clearTestExt, createTestExt } from '../../__tests__/testUtils.js'

const optionFingerprint = JSON.stringify({
  enableBookmarks: true,
  enableHistory: true,
  historyDaysAgo: 14,
  historyMaxItems: 100,
  historyIgnoreList: ['extension://'],
  bookmarksIgnoreFolderList: [],
  detectDuplicateBookmarks: false,
  displayFavicons: false,
})

const createStorage = (initialCache) => {
  let cache = initialCache
  return {
    get: jest.fn((_keys, callback) => callback({ 'searchDataCache:v1': cache })),
    set: jest.fn((value, callback) => {
      cache = value['searchDataCache:v1']
      callback()
    }),
    remove: jest.fn((_key, callback) => {
      cache = undefined
      callback()
    }),
    getCache: () => cache,
  }
}

async function loadModule({ initialCache, liveData }) {
  jest.resetModules()

  const storage = createStorage(initialCache)
  const getSearchData = jest.fn(() => Promise.resolve(liveData))
  const resetSimpleSearchState = jest.fn()
  const resetFuzzySearchState = jest.fn()
  const resetUniqueFoldersCache = jest.fn()

  await jest.unstable_mockModule('../../helper/browserApi.js', () => ({
    __esModule: true,
    browserApi: {
      runtime: { lastError: null },
      storage: { local: storage },
      tabs: {},
      tabGroups: {},
    },
    getBrowserTabs: jest.fn(() =>
      Promise.resolve([
        {
          id: 5,
          title: 'Open Example',
          url: 'https://example.com',
          active: true,
          windowId: 1,
        },
      ]),
    ),
    getBrowserTabGroups: jest.fn(() => Promise.resolve([])),
    convertBrowserTabs: jest.fn(() => [
      {
        type: 'tab',
        title: 'Open Example',
        url: 'example.com',
        originalUrl: 'https://example.com',
        originalId: 5,
        active: true,
        windowId: 1,
        searchStringLower: 'open example¦example.com',
      },
    ]),
  }))
  await jest.unstable_mockModule('../searchData.js', () => ({
    __esModule: true,
    getSearchData,
  }))
  await jest.unstable_mockModule('../../search/simpleSearch.js', () => ({
    resetSimpleSearchState,
  }))
  await jest.unstable_mockModule('../../search/fuzzySearch.js', () => ({
    resetFuzzySearchState,
  }))
  await jest.unstable_mockModule('../../search/taxonomySearch.js', () => ({
    resetUniqueFoldersCache,
  }))

  const module = await import('../searchDataCache.js')
  const storageModule = await import('../searchDataCacheStorage.js')
  createTestExt({
    opts: {
      enableTabs: true,
      enableBookmarks: true,
      enableHistory: true,
      historyDaysAgo: 14,
      historyMaxItems: 100,
      historyIgnoreList: ['extension://'],
      bookmarksIgnoreFolderList: [],
      detectDuplicateBookmarks: false,
      displayFavicons: false,
    },
    browserApi: {
      runtime: { lastError: null },
      storage: { local: storage },
    },
    searchCache: new Map([['query', [{ originalId: 'old-result' }]]]),
  })

  return {
    module,
    storageModule,
    mocks: {
      storage,
      getSearchData,
      resetSimpleSearchState,
      resetFuzzySearchState,
      resetUniqueFoldersCache,
    },
  }
}

describe('searchDataCache', () => {
  let localStorageStore = {}

  beforeEach(() => {
    clearTestExt()
    jest.restoreAllMocks()
    localStorageStore = {}
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => localStorageStore[key] ?? null)
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      localStorageStore[key] = value
    })
    jest.spyOn(Storage.prototype, 'removeItem').mockImplementation((key) => {
      delete localStorageStore[key]
    })
  })

  test('uses processed cache immediately and refreshes live data in the background', async () => {
    const savedAt = Date.now() - 10_000
    const cachedBookmark = {
      type: 'bookmark',
      originalId: 'bookmark-cache',
      title: 'Cached Example',
      url: 'example.com',
      originalUrl: 'https://example.com',
      searchStringLower: 'cached example¦example.com',
      lastVisitSecondsAgo: 20,
    }
    const liveData = {
      tabs: [],
      bookmarks: [
        {
          type: 'bookmark',
          originalId: 'bookmark-live',
          title: 'Live Example',
          url: 'live.example',
          originalUrl: 'https://live.example',
          searchStringLower: 'live example¦live.example',
        },
      ],
      history: [],
      bookmarkTree: [],
    }
    localStorageStore['searchDataCache:v1'] = JSON.stringify({
      version: 1,
      savedAt,
      optionsFingerprint: optionFingerprint,
      dataFingerprint: 'old',
      data: {
        bookmarks: [cachedBookmark],
        history: [],
      },
    })

    const { module, mocks } = await loadModule({ initialCache: null, liveData })

    const result = await module.getCachedThenFreshSearchData(ext.opts)

    expect(result.source).toBe('cache')
    expect(result.data.bookmarks[0]).toMatchObject({
      originalId: 'bookmark-cache',
      tab: true,
      openTabTitle: 'Open Example',
    })
    expect(result.data.bookmarks[0].lastVisitSecondsAgo).toBeGreaterThan(20)
    expect(mocks.getSearchData).toHaveBeenCalledTimes(1)

    const freshData = await result.refreshPromise

    expect(freshData.bookmarks).toEqual(liveData.bookmarks)
    expect(ext.searchCache.size).toBe(0)
    expect(mocks.resetSimpleSearchState).toHaveBeenCalledTimes(1)
    expect(mocks.resetFuzzySearchState).toHaveBeenCalledTimes(1)
    expect(mocks.resetUniqueFoldersCache).toHaveBeenCalledTimes(1)
    expect(Storage.prototype.setItem).toHaveBeenCalled()
  })

  test('falls back to live data and saves it when no usable cache exists', async () => {
    const liveData = {
      tabs: [],
      bookmarks: [{ originalId: 'bookmark-live', searchStringLower: 'live' }],
      history: [],
      bookmarkTree: [],
    }
    const { module, mocks } = await loadModule({ initialCache: null, liveData })

    const result = await module.getCachedThenFreshSearchData(ext.opts)

    expect(result).toEqual({
      data: liveData,
      refreshPromise: null,
      source: 'live',
    })
    expect(mocks.getSearchData).toHaveBeenCalledTimes(1)
    expect(Storage.prototype.setItem).toHaveBeenCalled()
  })

  test('clears persisted cache', async () => {
    localStorageStore['searchDataCache:v1'] = JSON.stringify({
      version: 1,
      savedAt: Date.now(),
      optionsFingerprint: optionFingerprint,
      dataFingerprint: 'old',
      data: { bookmarks: [], history: [] },
    })

    const { storageModule } = await loadModule({
      initialCache: null,
      liveData: { tabs: [], bookmarks: [], history: [], bookmarkTree: [] },
    })

    await storageModule.clearSearchDataCache()

    expect(Storage.prototype.removeItem).toHaveBeenCalledWith('searchDataCache:v1')
    expect(localStorageStore['searchDataCache:v1']).toBeUndefined()
  })
})
