import { browserApi, convertBrowserTabs, getBrowserTabGroups, getBrowserTabs } from '../helper/browserApi.js'
import { resetFuzzySearchState } from '../search/fuzzySearch.js'
import { resetSimpleSearchState } from '../search/simpleSearch.js'
import { resetUniqueFoldersCache } from '../search/taxonomySearch.js'
import { getSearchData } from './searchData.js'
import { loadRawSearchDataCache, saveRawSearchDataCache } from './searchDataCacheStorage.js'

const CACHE_VERSION = 1
const HASH_START = 2166136261
const HASH_PRIME = 16777619

const FINGERPRINT_OPTION_KEYS = [
  'enableBookmarks',
  'enableHistory',
  'historyDaysAgo',
  'historyMaxItems',
  'historyIgnoreList',
  'bookmarksIgnoreFolderList',
  'detectDuplicateBookmarks',
  'displayFavicons',
]

const TRANSIENT_BOOKMARK_FIELDS = ['tab', 'openTabTitle', 'openTabActive', 'group', 'groupLower', 'groupId']

function createOptionsFingerprint(options) {
  const values = {}
  for (const key of FINGERPRINT_OPTION_KEYS) {
    values[key] = options[key]
  }
  return JSON.stringify(values)
}

function updateHash(hash, value) {
  const text = value == null ? '' : String(value)
  let nextHash = hash
  for (let i = 0; i < text.length; i++) {
    nextHash ^= text.charCodeAt(i)
    nextHash = Math.imul(nextHash, HASH_PRIME) >>> 0
  }
  return nextHash
}

function hashItemList(items) {
  let hash = HASH_START
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    hash = updateHash(hash, item.originalId)
    hash = updateHash(hash, item.originalUrl)
    hash = updateHash(hash, item.title)
    hash = updateHash(hash, item.searchStringLower)
    hash = updateHash(hash, item.dateAdded)
    hash = updateHash(hash, item.visitCount)
    hash = updateHash(hash, Math.round(item.lastVisitSecondsAgo || 0))
  }
  return hash.toString(36)
}

function createDataFingerprint(data) {
  return `${data.bookmarks.length}:${hashItemList(data.bookmarks)}|${data.history.length}:${hashItemList(data.history)}`
}

function cloneSearchData(data) {
  return {
    tabs: data.tabs ? data.tabs.map((item) => ({ ...item })) : [],
    bookmarks: data.bookmarks ? data.bookmarks.map((item) => ({ ...item })) : [],
    history: data.history ? data.history.map((item) => ({ ...item })) : [],
    bookmarkTree: data.bookmarkTree ? data.bookmarkTree : [],
  }
}

function stripTransientBookmarkState(bookmark) {
  const cached = { ...bookmark }
  for (const key of TRANSIENT_BOOKMARK_FIELDS) {
    delete cached[key]
  }
  return cached
}

function createCachePayload(data, options) {
  const cacheData = {
    bookmarks: (data.bookmarks || []).map(stripTransientBookmarkState),
    history: (data.history || []).map((item) => ({ ...item })),
  }

  return {
    version: CACHE_VERSION,
    savedAt: Date.now(),
    optionsFingerprint: createOptionsFingerprint(options),
    dataFingerprint: createDataFingerprint(cacheData),
    data: cacheData,
  }
}

function applyCacheAge(data, savedAt) {
  const elapsedSeconds = Math.max(0, (Date.now() - savedAt) / 1000)
  const adjust = (item) => {
    if (typeof item.lastVisitSecondsAgo !== 'number') {
      return { ...item }
    }
    return {
      ...item,
      lastVisitSecondsAgo: item.lastVisitSecondsAgo + elapsedSeconds,
    }
  }

  return {
    bookmarks: data.bookmarks.map(adjust),
    history: data.history.map(adjust),
  }
}

function isCacheUsable(cache, options) {
  return (
    cache?.version === CACHE_VERSION &&
    cache.optionsFingerprint === createOptionsFingerprint(options) &&
    cache.data &&
    Array.isArray(cache.data.bookmarks) &&
    Array.isArray(cache.data.history)
  )
}

async function getLiveTabsData() {
  const [browserTabs, browserTabGroups] = await Promise.all([
    browserApi.tabs && ext.opts.enableTabs ? getBrowserTabs() : Promise.resolve([]),
    browserApi.tabGroups && ext.opts.enableTabs ? getBrowserTabGroups() : Promise.resolve([]),
  ])
  const groupMap = new Map(browserTabGroups.map((group) => [group.id, group]))
  return convertBrowserTabs(browserTabs, groupMap)
}

function flagBookmarksWithOpenTabs(bookmarks, tabs) {
  if (!bookmarks.length || !tabs.length) return

  const tabByUrl = new Map()
  for (const tab of tabs) {
    if (tab?.url) {
      tabByUrl.set(tab.url, tab)
    }
  }

  for (const bookmark of bookmarks) {
    const matchingTab = bookmark && tabByUrl.get(bookmark.url)
    if (matchingTab) {
      bookmark.tab = true
      bookmark.openTabTitle = matchingTab.title
      bookmark.openTabActive = matchingTab.active
      if (matchingTab.favIconUrl) {
        bookmark.favIconUrl = matchingTab.favIconUrl
      }
      if (matchingTab.group) {
        bookmark.group = matchingTab.group
        bookmark.groupLower = matchingTab.groupLower
        bookmark.groupId = matchingTab.groupId
      }
    }
  }
}

function resetSearchDataRuntimeCaches() {
  ext.searchCache?.clear()
  resetSimpleSearchState()
  resetFuzzySearchState()
  resetUniqueFoldersCache()
}

async function loadCachedSearchData(options) {
  try {
    const cache = await loadRawSearchDataCache()
    if (!isCacheUsable(cache, options)) {
      return null
    }

    const agedData = applyCacheAge(cache.data, cache.savedAt)
    const tabs = await getLiveTabsData()
    const data = {
      tabs,
      bookmarks: agedData.bookmarks,
      history: agedData.history,
      bookmarkTree: [],
    }
    flagBookmarksWithOpenTabs(data.bookmarks, data.tabs)
    return {
      data,
      fingerprint: cache.dataFingerprint,
    }
  } catch (err) {
    console.warn('Could not load search data cache.', err)
    return null
  }
}

async function saveSearchDataCache(data, options) {
  try {
    await saveRawSearchDataCache(createCachePayload(data, options))
  } catch (err) {
    console.warn('Could not save search data cache.', err)
  }
}

export async function getCachedThenFreshSearchData(options = ext.opts) {
  const cached = await loadCachedSearchData(options)

  if (!cached) {
    const liveData = await getSearchData()
    void saveSearchDataCache(liveData, options)
    return {
      data: liveData,
      refreshPromise: null,
      source: 'live',
    }
  }

  const refreshPromise = getSearchData()
    .then(async (liveData) => {
      const payload = createCachePayload(liveData, options)
      await saveRawSearchDataCache(payload)
      if (payload.dataFingerprint === cached.fingerprint) {
        return null
      }
      resetSearchDataRuntimeCaches()
      return cloneSearchData(liveData)
    })
    .catch((err) => {
      console.warn('Could not refresh search data cache.', err)
      return null
    })

  return {
    data: cached.data,
    refreshPromise,
    source: 'cache',
  }
}
