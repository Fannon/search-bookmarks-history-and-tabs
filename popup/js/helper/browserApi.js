import { cleanUpUrl, timeSince } from './utils.js'

// CHROME API (Manifest v2 / v3)

// Location of browser API.
// This is `browser` for firefox, and `chrome` for Chrome, Edge and Opera.
export const browserApi = window.browser || window.chrome || {}

//////////////////////////////////////////
// BROWSER TABS                         //
//////////////////////////////////////////

export async function getBrowserTabs(queryOptions) {
  queryOptions = queryOptions || { currentWindow: true }
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
    return {
      type: 'tab',
      title: entry.title,
      url: cleanUpUrl(entry.url),
      originalUrl: entry.url.replace(/\/$/, ''),
      originalId: entry.id,
      favIconUrl: entry.favIconUrl,
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

    // Parse out tags from bookmark title (starting with #)
    let title = entry.title
    let tagsText = ''
    let tagsArray = []
    if (ext.opts.general.tags && title) {
      const tagSplit = title.split('#')
      title = tagSplit.shift().trim()
      tagsArray = tagSplit
      for (const tag of tagSplit) {
        tagsText += '#' + tag.trim() + ' '
      }
      tagsText = tagsText.slice(0, -1)
    }

    let folderText = ''
    for (const folder of folderTrail) {
      folderText += '~' + folder + ' '
    }
    folderText = folderText.slice(0, -1)

    if (entry.url) {
      result.push({
        type: 'bookmark',
        originalId: entry.id,
        title: title,
        originalUrl: entry.url.replace(/\/$/, ''),
        url: cleanUpUrl(entry.url),
        dateAdded: entry.dateAdded,
        tags: tagsText,
        tagsArray: tagsArray,
        folder: folderText,
        folderArray: folderTrail,
      })
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
  if (ext.opts.history.ignoreList && ext.opts.history.ignoreList.length) {
    let ignoredHistoryCounter = 0
    history = history.filter((el) => {
      for (const ignoreUrlPrefix of ext.opts.history.ignoreList) {
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
    return {
      type: 'history',
      title: el.title,
      originalUrl: el.url.replace(/\/$/, ''),
      url: cleanUpUrl(el.url),
      visitCount: el.visitCount,
      lastVisit: ext.opts.general.lastVisit ? timeSince(new Date(el.lastVisitTime)) : undefined,
      lastVisitSecondsAgo: (now - el.lastVisitTime) / 1000,
      originalId: el.id,
    }
  })
}
