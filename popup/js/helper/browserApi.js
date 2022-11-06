import { cleanUpUrl, timeSince } from './utils.js'

// Location of browser API.
// This is `browser` for firefox, and `chrome` for Chrome, Edge and Opera.
export const browserApi = window.browser || window.chrome || {}

//////////////////////////////////////////
// BROWSER TABS                         //
//////////////////////////////////////////

export async function getBrowserTabs(queryOptions) {
  queryOptions = queryOptions || {}
  if (ext.opts.tabsOnlyCurrentWindow) {
    queryOptions.currentWindow = true
  }
  return new Promise((resolve, reject) => {
    if (browserApi.tabs) {
      browserApi.tabs.query(queryOptions, (tabs, err) => {
        if (err) {
          return reject(err)
        }
        return resolve(tabs)
      })
    } else {
      console.warn(`No browser tab API found. Returning no results.`)
      return resolve([])
    }
  })
}

export function convertBrowserTabs(chromeTabs) {
  return chromeTabs.map((entry) => {
    const cleanUrl = cleanUpUrl(entry.url)
    return {
      type: 'tab',
      title: entry.title,
      url: cleanUrl,
      originalUrl: entry.url.replace(/\/$/, ''),
      originalId: entry.id,
      favIconUrl: entry.favIconUrl,
      active: entry.active,
      windowId: entry.windowId,
      searchString: createSearchString(entry.title, cleanUrl),
    }
  })
}

//////////////////////////////////////////
// BOOKMARKS                            //
//////////////////////////////////////////

export async function getBrowserBookmarks() {
  return new Promise((resolve, reject) => {
    if (browserApi.bookmarks && browserApi.bookmarks.getTree) {
      browserApi.bookmarks.getTree((bookmarks, err) => {
        if (err) {
          return reject(err)
        }
        return resolve(bookmarks)
      })
    } else {
      console.warn(`No browser bookmark API found. Returning no results.`)
      return resolve([])
    }
  })
}

/**
 * Recursive function to return bookmarks in our internal, flat array format
 */
export function convertBrowserBookmarks(bookmarks, folderTrail, depth) {
  depth = depth || 1
  let result = []
  folderTrail = folderTrail || []

  for (const entry of bookmarks) {
    let newFolderTrail = folderTrail.slice() // clone
    // Only consider bookmark folders that have a title and have
    // at least a depth of 2, so we skip the default chrome "system" folders
    if (depth > 2) {
      newFolderTrail = folderTrail.concat(entry.title)
    }

    if (entry.url) {
      let title = entry.title
      let customBonusScore = 0

      const regex = /[ ][+]([0-9]+)/
      const match = title.match(regex)
      if (match && match.length > 0) {
        title = title.replace(match[0], '')
        if (match.length !== 2) {
          console.error(`Unexpected custom bonus score match length`, match, entry)
        } else {
          customBonusScore = parseInt(match[1])
        }
      }

      const mappedEntry = {
        type: 'bookmark',
        originalId: entry.id,
        title: title,
        originalUrl: entry.url.replace(/\/$/, ''),
        url: cleanUpUrl(entry.url),
        dateAdded: entry.dateAdded,
        customBonusScore,
      }

      // Parse out tags from bookmark title (starting with #)
      let tagsText = ''
      let tagsArray = []
      if (title) {
        const tagSplit = title.split('#').map((el) => el.trim())
        title = tagSplit.shift()
        tagsArray = tagSplit
        for (const tag of tagSplit) {
          tagsText += '#' + tag.trim() + ' '
        }
        tagsText = tagsText.slice(0, -1)
      }

      mappedEntry.title = title
      mappedEntry.tags = tagsText
      mappedEntry.tagsArray = tagsArray

      // Consider the folder names / structure of bookmarks
      let folderText = ''
      for (const folder of folderTrail) {
        folderText += '~' + folder + ' '
      }
      folderText = folderText.slice(0, -1)

      mappedEntry.folder = folderText
      mappedEntry.folderArray = folderTrail

      mappedEntry.searchString = createSearchString(title, mappedEntry.url, mappedEntry.tags, mappedEntry.folder)

      result.push(mappedEntry)
    }

    if (entry.children) {
      result = result.concat(convertBrowserBookmarks(entry.children, newFolderTrail, depth + 1))
    }
  }

  return result
}

//////////////////////////////////////////
// BROWSER HISTORY                      //
//////////////////////////////////////////

/**
 * Gets chrome browsing history.
 * Warning: This chrome API call tends to be rather slow
 */
export async function getBrowserHistory(daysAgo, maxResults) {
  return new Promise((resolve, reject) => {
    if (browserApi.history) {
      browserApi.history.search(
        {
          text: '',
          maxResults: maxResults,
          startTime: Date.now() - 1000 * 60 * 60 * 24 * daysAgo,
          endTime: Date.now(),
        },
        (history, err) => {
          if (err) {
            return reject(err)
          }
          return resolve(history)
        },
      )
    } else {
      console.warn(`No browser history API found. Returning no results.`)
      return []
    }
  })
}

/**
 * Convert chrome history into our internal, flat array format
 */
export function convertBrowserHistory(history) {
  if (ext.opts.historyIgnoreList && ext.opts.historyIgnoreList.length) {
    let ignoredHistoryCounter = 0
    history = history.filter((el) => {
      for (const ignoreUrlPrefix of ext.opts.historyIgnoreList) {
        if (el.url.startsWith(ignoreUrlPrefix)) {
          ignoredHistoryCounter += 1
          return false
        }
      }
      return true
    })
    console.debug(`Ignored ${ignoredHistoryCounter} history items due to ignore list`)
  }

  const now = Date.now()
  return history.map((el) => {
    const cleanUrl = cleanUpUrl(el.url)
    return {
      type: 'history',
      title: el.title,
      originalUrl: el.url.replace(/\/$/, ''),
      url: cleanUrl,
      visitCount: el.visitCount,
      lastVisit: ext.opts.displayLastVisit ? timeSince(new Date(el.lastVisitTime)) : undefined,
      lastVisitSecondsAgo: (now - el.lastVisitTime) / 1000,
      originalId: el.id,
      searchString: createSearchString(el.title, cleanUrl),
    }
  })
}

export function createSearchString(title, url, tags, folder) {
  const separator = '¦'
  let searchString = title + separator + url
  if (tags) {
    searchString += separator + tags
  }
  if (folder) {
    searchString += separator + folder
  }
  return searchString
}
