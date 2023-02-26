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
  const result = {
    tabs: [],
    bookmarks: [],
    history: [],
  }

  // FIRST: Get data
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
    const browserHistory = await getBrowserHistory(ext.opts.historyDaysAgo, ext.opts.historyMaxItems)
    result.history = convertBrowserHistory(browserHistory)
    if (ext.opts.debug) {
      performance.mark('get-data-history-end')
      performance.measure('get-data-history', 'get-data-history-start', 'get-data-history-end')
    }
  }

  // Use mock data (for localhost preview / development)
  // To do this, create a http server (e.g. live-server) in popup/
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
  }

  // SECOND: Merge history with bookmarks and tabs and clean up data

  // Build maps with URL as key, so we have fast hashmap access
  const historyMap = result.history.reduce(
    (obj, item, index) => ((obj[item.originalUrl] = { ...item, index }), obj),
    {},
  )

  const historyToDelete = []

  // merge history into bookmarks
  result.bookmarks = result.bookmarks.map((el) => {
    if (historyMap[el.originalUrl]) {
      historyToDelete.push(historyMap[el.originalUrl].index)
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
      historyToDelete.push(historyMap[el.originalUrl].index)
      return {
        ...historyMap[el.originalUrl],
        ...el,
      }
    } else {
      return el
    }
  })

  // Remove all history entries that have been merged
  for (const index of historyToDelete) {
    delete result.history[index]
  }
  result.history = result.history.filter((el) => el)

  // Add index to all search results
  for (let i = 0; i < result.tabs.length; i++) {
    result.tabs[i].index = i
  }
  for (let i = 0; i < result.bookmarks.length; i++) {
    result.bookmarks[i].index = i
  }
  for (let i = 0; i < result.history.length; i++) {
    result.history[i].index = i
  }

  if (ext.opts.debug) {
    console.debug(
      `Indexed ${result.tabs.length} tabs, ${result.bookmarks.length} bookmarks and ${result.history.length} history items.`,
    )
  }

  return result
}
