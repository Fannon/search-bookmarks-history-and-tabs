import { getBrowserTabs } from '../helper/browserApi.js'

/**
 * If we don't have a search term yet (or not sufficiently long), display current tab related entries.
 *
 * Finds out if there are any bookmarks or history that match our current open URL.
 */
export async function addDefaultEntries() {
  let results = []

  if (ext.model.searchMode === 'history' && ext.model.history) {
    // Display recent history by default
    results = ext.model.history.map((el) => {
      return {
        searchScore: 1,
        ...el,
      }
    })
  } else if (ext.model.searchMode === 'tabs' && ext.model.tabs) {
    // Display last opened tabs by default
    results = ext.model.tabs
      .map((el) => {
        return {
          searchScore: 1,
          ...el,
        }
      })
      .sort((a, b) => {
        return a.lastVisitSecondsAgo - b.lastVisitSecondsAgo
      })
  } else if (ext.model.searchMode === 'bookmarks' && ext.model.bookmarks) {
    // Display all bookmarks by default
    results = ext.model.bookmarks.map((el) => {
      return {
        searchScore: 1,
        ...el,
      }
    })
  } else {
    // All other modes: Find bookmarks / history that matches current page URL
    let currentUrl = window.location.href
    const [tab] = await getBrowserTabs({ active: true, currentWindow: true })
    if (!tab) {
      return []
    }

    // Remove trailing slash or hash from URL, so the comparison works better
    currentUrl = tab.url.replace(/[/#]$/, '')

    results.push(...ext.model.bookmarks.filter((el) => el.originalUrl === currentUrl))
    results.push(...ext.model.history.filter((el) => el.originalUrl === currentUrl))
  }

  ext.model.result = results
  return results
}
