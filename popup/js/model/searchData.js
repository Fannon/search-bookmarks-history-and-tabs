import {
  browserApi,
  convertBrowserBookmarks,
  convertBrowserHistory,
  convertBrowserTabs,
  getBrowserBookmarks,
  getBrowserHistory,
  getBrowserTabs,
} from '../helper/browserApi.js'

/**
 * Efficiently merges history data into bookmarks or tabs using lazy evaluation
 * Only creates new objects when there are actual history matches to merge
 * @param {Array} items - Array of bookmarks or tabs
 * @param {Map} historyMap - Map of URL to history item
 * @param {Set<string>} [mergedUrls] - Tracks which history URLs were merged
 * @returns {Array} - Merged array with history data
 */
function mergeHistoryLazily(items, historyMap, mergedUrls) {
  if (!items.length) return items

  let hasMerged = false
  const result = new Array(items.length)

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const historyEntry = historyMap.get(item.originalUrl)

    if (historyEntry) {
      if (mergedUrls) {
        mergedUrls.add(item.originalUrl)
      }
      result[i] = {
        ...item,
        lastVisitSecondsAgo:
          historyEntry.lastVisitSecondsAgo ?? item.lastVisitSecondsAgo,
        visitCount: historyEntry.visitCount ?? item.visitCount,
      }
      hasMerged = true
    } else {
      // Keep original item unchanged
      result[i] = item
    }
  }

  // Only return new array if we actually merged something, otherwise return original
  return hasMerged ? result : items
}

/**
 * Gets the actual data that we search through
 *
 * Merges and removes some items (e.g. duplicates) before they are indexed
 */
export async function getSearchData() {
  const startTime = Date.now()
  const result = {
    tabs: [],
    bookmarks: [],
    history: [],
  }

  // Use mock data (for localhost preview / development)
  if (!browserApi.bookmarks || !browserApi.history) {
    console.warn(`No Chrome API found. Switching to local dev mode with mock data only`)
    try {
      const requestChromeMockData = await fetch('./mockData/chrome.json')
      const chromeMockData = await requestChromeMockData.json()
      result.tabs = convertBrowserTabs(chromeMockData.tabs)
      if (ext.opts.enableBookmarks) {
        result.bookmarks = convertBrowserBookmarks(chromeMockData.bookmarks)
      }
      if (ext.opts.enableHistory) {
        result.history = convertBrowserHistory(chromeMockData.history)
      }
    } catch (err) {
      console.warn('Could not load example mock data', err)
    }
  } else {
    if (browserApi.tabs && ext.opts.enableTabs) {
      if (ext.opts.debug) {
        performance.mark('get-data-tabs-start')
      }
      const browserTabs = await getBrowserTabs()
      result.tabs = convertBrowserTabs(browserTabs)
      if (ext.opts.debug) {
        performance.mark('get-data-tabs-end')
        performance.measure('get-data-tabs', 'get-data-tabs-start', 'get-data-tabs-end')
      }
    }
    if (browserApi.bookmarks && ext.opts.enableBookmarks) {
      if (ext.opts.debug) {
        performance.mark('get-data-bookmarks-start')
      }
      const browserBookmarks = await getBrowserBookmarks()
      result.bookmarks = convertBrowserBookmarks(browserBookmarks)
      if (ext.opts.debug) {
        performance.mark('get-data-bookmarks-end')
        performance.measure('get-data-bookmarks', 'get-data-bookmarks-start', 'get-data-bookmarks-end')
      }
    }
    if (browserApi.history && ext.opts.enableHistory) {
      if (ext.opts.debug) {
        performance.mark('get-data-history-start')
      }
      let startTime = Date.now() - 1000 * 60 * 60 * 24 * ext.opts.historyDaysAgo
      const browserHistory = await getBrowserHistory(startTime, ext.opts.historyMaxItems)
      result.history = convertBrowserHistory(browserHistory)
      if (ext.opts.debug) {
        performance.mark('get-data-history-end')
        performance.measure('get-data-history', 'get-data-history-start', 'get-data-history-end')
      }

      // Build maps with URL as key, so we have fast hashmap access
      const historyMap = new Map(result.history.map((item) => [item.originalUrl, item]))

      const mergedHistoryUrls = new Set()

      result.bookmarks = mergeHistoryLazily(result.bookmarks, historyMap, mergedHistoryUrls)
      result.tabs = mergeHistoryLazily(result.tabs, historyMap, mergedHistoryUrls)

      result.history = result.history.filter((item) => !mergedHistoryUrls.has(item.originalUrl))
    }
  }
  if (ext.opts.debug) {
    console.debug(
      `Loaded ${result.tabs.length} tabs, ${result.bookmarks.length} bookmarks and ${
        result.history.length
      } history items in ${Date.now() - startTime}ms.`,
    )
    let oldestHistoryItem = 0
    for (const item of result.history) {
      if (item.lastVisitSecondsAgo > oldestHistoryItem) {
        oldestHistoryItem = item.lastVisitSecondsAgo
      }
    }
    console.debug(
      `Oldest history item is ${Math.round(oldestHistoryItem / 60 / 60 / 24)} days ago. Max history back is ${
        ext.opts.historyDaysAgo
      } days (Option: historyDaysAgo).`,
    )
  }
  return result
}
