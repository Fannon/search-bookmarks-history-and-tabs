/**
 * @file Loads and normalizes the datasets searched by the popup.
 * Fetches browser data, applies option filters, and prepares derived indexes.
 */

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
 * Merge history data into items lazily so new objects are created only when needed.
 * @param {Array} items
 * @param {Map} historyMap
 * @param {Set<string>} [mergedUrls]
 * @returns {Array}
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
 * Fetch and normalize the datasets used by the popup search experience.
 * @returns {Promise<{tabs: Array, bookmarks: Array, history: Array}>}
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
      const browserTabs = await getBrowserTabs()
      result.tabs = convertBrowserTabs(browserTabs)
    }
    if (browserApi.bookmarks && ext.opts.enableBookmarks) {
      const browserBookmarks = await getBrowserBookmarks()
      result.bookmarks = convertBrowserBookmarks(browserBookmarks)
    }
    if (browserApi.history && ext.opts.enableHistory) {
      let startTime = Date.now() - 1000 * 60 * 60 * 24 * ext.opts.historyDaysAgo
      const browserHistory = await getBrowserHistory(startTime, ext.opts.historyMaxItems)
      result.history = convertBrowserHistory(browserHistory)

      // Build maps with URL as key, so we have fast hashmap access
      const historyMap = new Map(result.history.map((item) => [item.originalUrl, item]))

      const mergedHistoryUrls = new Set()

      result.bookmarks = mergeHistoryLazily(result.bookmarks, historyMap, mergedHistoryUrls)
      result.tabs = mergeHistoryLazily(result.tabs, historyMap, mergedHistoryUrls)

      result.history = result.history.filter((item) => !mergedHistoryUrls.has(item.originalUrl))
    }
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
