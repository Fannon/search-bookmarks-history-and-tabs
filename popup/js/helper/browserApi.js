/**
 * @file Normalises browser APIs for bookmarks, tabs, and history sources.
 *
 * Responsibilities:
 * - Fetch raw entries with defensive fallbacks for browsers that omit certain APIs.
 * - Convert every record into the shared `searchItem` shape (type, title, url, tags, folder trail, search strings).
 * - Parse inline annotations like `#tag` taxonomy markers and `+20` custom bonus hints from bookmark titles.
 * - Clean URLs/titles by stripping protocol, `www`, and trailing slashes to stabilise comparisons and cache keys.
 * - Preserve breadcrumb-style folder metadata so taxonomy pages and scoring rules stay in sync across browsers.
 */

import { cleanUpUrl } from './utils.js'

export const browserApi = window.chrome || window.browser || {}

/**
 * Retrieve browser tabs with optional query filters while respecting user options.
 *
 * @param {Object} [queryOptions={}] - Filters passed to the tabs API.
 * @returns {Promise<Array>} Tab objects, excluding extension URLs.
 */
export async function getBrowserTabs(queryOptions = {}) {
  if (ext.opts.tabsOnlyCurrentWindow) {
    queryOptions.currentWindow = true
  }
  if (browserApi.tabs) {
    return (await browserApi.tabs.query(queryOptions)).filter((el) => {
      const url = typeof el?.url === 'string' ? el.url : ''
      if (!url.trim()) {
        return false
      }
      return !url.includes('extension://')
    })
  } else {
    console.warn(`No browser tab API found. Returning no results.`)
    return []
  }
}

/**
 * Normalize browser tab objects into the shared search item shape.
 *
 * @param {Array<Object>} chromeTabs - Raw tab entries from the browser API.
 * @returns {Array<Object>} Standardised tab entries.
 */
export function convertBrowserTabs(chromeTabs) {
  return chromeTabs
    .filter((el) => typeof el?.url === 'string' && el.url.trim())
    .map((el) => {
      const rawUrl = el.url
      const cleanUrl = cleanUpUrl(rawUrl)
      const searchString = createSearchString(el.title, cleanUrl)
      return {
        type: 'tab',
        title: getTitle(el.title, cleanUrl),
        url: cleanUrl,
        originalUrl: rawUrl.replace(/\/$/, ''),
        originalId: el.id,
        active: el.active,
        windowId: el.windowId,
        searchString,
        searchStringLower: searchString.toLowerCase(),
        lastVisitSecondsAgo: el.lastAccessed ? (Date.now() - el.lastAccessed) / 1000 : undefined,
      }
    })
}

/**
 * Retrieve the bookmark tree from the browser API.
 *
 * @returns {Promise<Array>} Bookmark hierarchy or empty array when unsupported.
 */
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
 *
 * @param {Array<Object>} bookmarks - Raw bookmark tree nodes.
 * @param {Array<string>} [folderTrail] - Accumulated folder hierarchy.
 * @param {number} [depth] - Current traversal depth.
 * @returns {Array<Object>} Flattened bookmark entries.
 */
export function convertBrowserBookmarks(bookmarks, folderTrail, depth, seenByUrl) {
  depth = depth || 1
  let result = []
  folderTrail = folderTrail || []
  seenByUrl = seenByUrl || new Map()

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
      mappedEntry.searchStringLower = mappedEntry.searchString.toLowerCase()

      const duplicateKey = mappedEntry.originalUrl || mappedEntry.url
      if (duplicateKey) {
        const existingEntry = seenByUrl.get(duplicateKey)
        if (existingEntry) {
          existingEntry.dupe = true
          mappedEntry.dupe = true
          console.warn(
            `Duplicate bookmark detected for ${
              mappedEntry.originalUrl || mappedEntry.url || 'unknown URL'
            } in folder:`,
            mappedEntry.folderArray || [],
          )
        } else {
          seenByUrl.set(duplicateKey, mappedEntry)
        }
      }

      result.push(mappedEntry)
    }

    if (entry.children) {
      result = result.concat(
        convertBrowserBookmarks(entry.children, newFolderTrail, depth + 1, seenByUrl),
      )
    }
  }

  return result
}

/**
 * Gets chrome browsing history.
 * Warning: This chrome API call tends to be rather slow
 *
 * @param {number} startTime - Earliest visit timestamp to include.
 * @param {number} maxResults - Maximum number of history items.
 * @returns {Promise<Array>} History entries or empty array when unsupported.
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
 *
 * @param {Array<Object>} history - Raw history entries.
 * @returns {Array<Object>} Normalised history items.
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
    console.debug(`Ignored ${ignoredHistoryCounter} history items due to ignore list`)
  }

  const now = Date.now()
  return history.map((el) => {
    const cleanUrl = cleanUpUrl(el.url)
    const searchString = createSearchString(el.title, cleanUrl)
    return {
      type: 'history',
      title: getTitle(el.title, cleanUrl),
      originalUrl: el.url.replace(/\/$/, ''),
      url: cleanUrl,
      visitCount: el.visitCount,
      lastVisitSecondsAgo: (now - el.lastVisitTime) / 1000,
      originalId: el.id,
      searchString,
      searchStringLower: searchString.toLowerCase(),
    }
  })
}

/**
 * Combine title/url/tags/folder fields into a single search string.
 *
 * @param {string} title - Bookmark title.
 * @param {string} url - Normalised URL.
 * @param {string} [tags] - Tag string.
 * @param {string} [folder] - Folder breadcrumb string.
 * @returns {string} Combined search string.
 */
export function createSearchString(title, url, tags, folder) {
  const separator = '¦'
  let searchString = ''
  if (!url) {
    console.error('createSearchString: No URL given', { title, url, tags, folder })
    return searchString
  }
  // Keep the original casing intact. Fuzzy search relies on searchString
  // to generate highlighted snippets for the UI, so we compute
  // searchStringLower separately when building the data model.
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

/**
 * Ensure bookmarks have a human-readable title, falling back to shortened URLs.
 *
 * @param {string} title - Original title.
 * @param {string} url - Normalised URL.
 * @returns {string} Cleaned title.
 */
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

/**
 * Shorten overly long titles or URLs for display purposes.
 *
 * @param {string} title - Title to shorten.
 * @returns {string} Possibly truncated title.
 */
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
