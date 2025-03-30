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
      if (ext.opts.enableBookmarks) {
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
      const historyMap = result.history.reduce(
        (obj, item, index) => ((obj[item.originalUrl] = { ...item, index }), obj),
        {},
      )
      // merge history into bookmarks
      result.bookmarks = result.bookmarks.map((el) => {
        if (historyMap[el.originalUrl]) {
          delete result.history[historyMap[el.originalUrl].index]
          return {
            ...historyMap[el.originalUrl],
            ...el,
          }
        } else {
          return el
        }
      })

      // merge history into open tabs
      result.tabs = result.tabs.map((el) => {
        if (historyMap[el.originalUrl]) {
          delete result.history[historyMap[el.originalUrl].index]
          return {
            ...historyMap[el.originalUrl],
            ...el,
          }
        } else {
          return el
        }
      })

      result.history = result.history.filter((el) => el)
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
