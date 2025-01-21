import { cleanUpUrl } from './utils.js'

export const browserApi = window.chrome || window.browser || {}

export async function getBrowserTabs(queryOptions = {}) {
  if (ext.opts.tabsOnlyCurrentWindow) {
    queryOptions.currentWindow = true
  }
  if (browserApi.tabs) {
    return await browserApi.tabs.query(queryOptions)
  } else {
    console.warn(`No browser tab API found. Returning no results.`)
    return []
  }
}

export function convertBrowserTabs(chromeTabs) {
  return chromeTabs.map((el) => {
    const cleanUrl = cleanUpUrl(el.url)
    return {
      type: 'tab',
      title: getTitle(el.title, cleanUrl),
      url: cleanUrl,
      originalUrl: el.url.replace(/\/$/, ''),
      originalId: el.id,
      active: el.active,
      windowId: el.windowId,
      searchString: createSearchString(el.title, cleanUrl),
      lastVisitSecondsAgo: el.lastAccessed ? (Date.now() - el.lastAccessed) / 1000 : undefined,
    }
  })
}

export async function getBrowserBookmarks() {
  if (browserApi.bookmarks && browserApi.bookmarks.getTree) {
    return browserApi.bookmarks.getTree()
  } else {
    console.warn(`No browser bookmark API found. Returning no results.`)
    return []
  }
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

    // Filter out bookmarks by ignored folder
    if (ext.opts.bookmarksIgnoreFolderList) {
      if (folderTrail.some((el) => ext.opts.bookmarksIgnoreFolderList.includes(el))) {
        continue
      }
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

      // Parse out tags from bookmark title (starting with " #")
      let tagsText = ''
      let tagsArray = []
      if (title) {
        const tagSplit = title.split(' #').map((el) => el.trim())
        title = tagSplit.shift()

        tagsArray = tagSplit.filter((el) => {
          if (el.match(/^\d/)) {
            title += ' #' + el
            return false
          } else if (!el.trim()) {
            return false
          } else {
            return el
          }
        })
        for (const tag of tagsArray) {
          tagsText += '#' + tag.trim() + ' '
        }
        tagsText = tagsText.slice(0, -1)
      }

      mappedEntry.title = getTitle(title, mappedEntry.url)
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

      mappedEntry.searchString = createSearchString(
        mappedEntry.title,
        mappedEntry.url,
        mappedEntry.tags,
        mappedEntry.folder,
      )

      result.push(mappedEntry)
    }

    if (entry.children) {
      result = result.concat(convertBrowserBookmarks(entry.children, newFolderTrail, depth + 1))
    }
  }

  return result
}

/**
 * Gets chrome browsing history.
 * Warning: This chrome API call tends to be rather slow
 */
export async function getBrowserHistory(startTime, maxResults) {
  if (browserApi.history) {
    return await browserApi.history.search({
      text: '',
      startTime: startTime,
      maxResults: maxResults,
    })
  } else {
    console.warn(`No browser history API found. Returning no results.`)
    return []
  }
}

/**
 * Convert chrome history into our internal, flat array format
 */
export function convertBrowserHistory(history) {
  if (ext.opts.historyIgnoreList && ext.opts.historyIgnoreList.length) {
    let ignoredHistoryCounter = 0
    history = history.filter((el) => {
      for (const ignoreUrl of ext.opts.historyIgnoreList) {
        if (el.url.includes(ignoreUrl)) {
          ignoredHistoryCounter += 1
          return false
        }
      }
      return true
    })
    if (ext.opts.debug) {
      console.debug(`Ignored ${ignoredHistoryCounter} history items due to ignore list`)
    }
  }

  const now = Date.now()
  return history.map((el) => {
    const cleanUrl = cleanUpUrl(el.url)
    return {
      type: 'history',
      title: getTitle(el.title, cleanUrl),
      originalUrl: el.url.replace(/\/$/, ''),
      url: cleanUrl,
      visitCount: el.visitCount,
      lastVisitSecondsAgo: (now - el.lastVisitTime) / 1000,
      originalId: el.id,
      searchString: createSearchString(el.title, cleanUrl),
    }
  })
}

export function createSearchString(title, url, tags, folder) {
  const separator = '¦'
  let searchString = ''
  if (!url) {
    console.error('createSearchString: No URL given', { title, url, tags, folder })
    return searchString
  }
  if (title && !title.toLowerCase().includes(url.toLowerCase())) {
    searchString += title + separator + url
  } else {
    searchString += url
  }
  if (tags) {
    searchString += separator + tags
  }
  if (folder) {
    searchString += separator + folder
  }
  return searchString
}

export function getTitle(title, url) {
  let newTitle = title || ''
  if (newTitle.includes('http://') || newTitle.includes('https://') || newTitle === url) {
    newTitle = shortenTitle(cleanUpUrl(newTitle))
  }
  if (!newTitle.trim()) {
    newTitle = shortenTitle(cleanUpUrl(url))
  }
  return newTitle
}

export function shortenTitle(title) {
  const urlTitleLengthRestriction = 85
  const maxLengthRestriction = 512
  if (title && title.length > urlTitleLengthRestriction) {
    return `${title.substring(0, urlTitleLengthRestriction - 3)}...`
  } else if (title && title.length > maxLengthRestriction) {
    return `${title.substring(0, maxLengthRestriction - 3)}...`
  } else {
    return title
  }
}
