/**
 * @file Loads and normalizes the datasets searched by the popup.
 *
 * Responsibilities:
 * - Fetch bookmarks, tabs, and history from the browser API layer and convert them into the shared `searchItem` format.
 * - Apply option-driven limits (history window, item caps, ignored folders) to balance freshness with performance.
 * - Merge history metadata lazily into bookmarks/tabs only when URLs overlap, avoiding unnecessary allocations.
 * - Prepare derived indexes (search strings, taxonomy aggregates) for downstream search strategies and views.
 */

import {
  browserApi,
  convertBrowserBookmarks,
  convertBrowserHistory,
  convertBrowserTabs,
  getBrowserBookmarks,
  getBrowserHistory,
  getBrowserTabGroups,
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
        lastVisitSecondsAgo: historyEntry.lastVisitSecondsAgo ?? item.lastVisitSecondsAgo,
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
 * Annotate bookmark entries that have a currently open browser tab.
 * Only runs if detectBookmarksWithOpenTabs option is enabled.
 *
 * @param {Array} bookmarks - Bookmark search items.
 * @param {Array} tabs - Tab search items.
 */
function flagBookmarksWithOpenTabs(bookmarks, tabs) {
  if (!ext.opts.detectBookmarksWithOpenTabs) {
    return
  }

  if (!bookmarks.length || !tabs.length) {
    return
  }

  const tabUrls = new Set()
  for (const tab of tabs) {
    if (tab?.url) {
      tabUrls.add(tab.url)
    }
  }

  for (const bookmark of bookmarks) {
    if (bookmark && tabUrls.has(bookmark.url)) {
      bookmark.tab = true
    }
  }
}

/**
 * Fetch and normalize the datasets used by the popup search experience.
 *
 * @returns {Promise<{tabs: Array, bookmarks: Array, history: Array}>} Prepared search data.
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
    // Fetch all browser data sources in parallel for faster startup
    const [browserTabs, browserBookmarks, browserHistory, browserTabGroups] = await Promise.all([
      browserApi.tabs && ext.opts.enableTabs ? getBrowserTabs() : Promise.resolve([]),
      browserApi.bookmarks && ext.opts.enableBookmarks ? getBrowserBookmarks() : Promise.resolve([]),
      browserApi.history && ext.opts.enableHistory
        ? getBrowserHistory(Date.now() - 1000 * 60 * 60 * 24 * ext.opts.historyDaysAgo, ext.opts.historyMaxItems)
        : Promise.resolve([]),
      browserApi.tabGroups && ext.opts.enableTabs ? getBrowserTabGroups() : Promise.resolve([]),
    ])

    // Build group lookup map
    const groupMap = new Map(browserTabGroups.map((g) => [g.id, g]))

    // Convert browser data to internal format
    result.tabs = convertBrowserTabs(browserTabs, groupMap)
    result.bookmarks = convertBrowserBookmarks(browserBookmarks)
    result.history = convertBrowserHistory(browserHistory)

    // Merge history data into bookmarks and tabs if history is enabled
    if (browserApi.history && ext.opts.enableHistory && result.history.length > 0) {
      // Build maps with URL as key, so we have fast hashmap access
      const historyMap = new Map(result.history.map((item) => [item.originalUrl, item]))

      const mergedHistoryUrls = new Set()

      result.bookmarks = mergeHistoryLazily(result.bookmarks, historyMap, mergedHistoryUrls)
      result.tabs = mergeHistoryLazily(result.tabs, historyMap, mergedHistoryUrls)

      result.history = result.history.filter((item) => !mergedHistoryUrls.has(item.originalUrl))
    }

    // Flag bookmarks with open tabs (if feature is enabled)
    flagBookmarksWithOpenTabs(result.bookmarks, result.tabs)
  }
  console.debug(
    `Loaded ${result.tabs.length} tabs, ${result.bookmarks.length} bookmarks and ${
      result.history.length
    } history items in ${Date.now() - startTime}ms.`,
  )
  // let oldestHistoryItem = 0
  // for (const item of result.history) {
  //   if (item.lastVisitSecondsAgo > oldestHistoryItem) {
  //     oldestHistoryItem = item.lastVisitSecondsAgo
  //   }
  // }
  // console.debug(
  //   `Oldest history item is ${Math.round(oldestHistoryItem / 60 / 60 / 24)} days ago. Max history back is ${
  //     ext.opts.historyDaysAgo
  //   } days (Option: historyDaysAgo).`,
  // )
  return result
}
