import { browserApi } from "../helper/browserApi.js"

/**
 * If we don't have a search term yet (or not sufficiently long), display current tab related entries.
 *
 * Finds out if there are any bookmarks or history that match our current open URL.
 */
export async function addDefaultEntries() {
  console.debug(`Searching for default results`)

  let results = []

  if (ext.model.searchMode === "history") {
    // Display recent history by default
    console.log("Default history results")
    results = ext.model.history.map((el) => {
      return {
        searchScore: 1,
        ...el,
      }
    })
  } else if (ext.model.searchMode === "tabs") {
    // Display last opened tabs by default
    console.log("Default tabs results")
    results = ext.model.tabs.map((el) => {
      return {
        searchScore: 1,
        ...el,
      }
    })
  } else if (ext.model.searchMode === "bookmarks") {
    // Display all bookmarks by default
    results = ext.model.bookmarks.map((el) => {
      return {
        searchScore: 1,
        ...el,
      }
    })
  } else {
    // All other modes: Find bookmark / history that matches current page URL
    let currentUrl = window.location.href
    if (browserApi.tabs) {
      const queryOptions = { active: true, currentWindow: true }
      const [tab] = await browserApi.tabs.query(queryOptions)
      currentUrl = tab.url
    }
    // Remove trailing slash from URL, so the startsWith search works better
    currentUrl = currentUrl.replace(/\/$/, "")

    // Find if current URL has corresponding bookmark(s)
    const foundBookmarks = ext.model.bookmarks.filter((el) => el.originalUrl.startsWith(currentUrl))
    results.push(...foundBookmarks)

    // Find if we have browser history that has the same URL
    let foundHistory = ext.model.history.filter((el) => currentUrl === el.originalUrl)
    results.push(...foundHistory)

    results = results.map((el) => {
      return {
        searchScore: 1,
        ...el,
      }
    })
  }

  ext.model.result = results
  return results
}
