const BONUS_SCORE_REGEX = /[ ][+]([0-9]+)/
const TAG_NUMERIC_CHECK_REGEX = /^\d/
const URL_ROOT_CLEANUP_REGEX = /\/$/
const REGEX_SPECIAL_CHARS_REGEX = /[.*+?^${}()|[\]/-]/g

/**
 * @file Normalizes browser APIs for bookmarks, tabs, and history sources.
 *
 * Responsibilities:
 * - Fetch raw entries with defensive fallbacks for browsers that omit certain APIs.
 * - Convert every record into the shared `searchItem` shape (type, title, url, tags, folder trail, search strings).
 * - Parse inline annotations like `#tag` taxonomy markers and `+20` custom bonus hints from bookmark titles.
 * - Clean URLs/titles by stripping protocol, `www`, and trailing slashes to stabilize comparisons and cache keys.
 * - Preserve breadcrumb-style folder metadata so taxonomy pages and scoring rules stay in sync across browsers.
 */

import { cleanUpUrl } from './utils.js'

export const browserApi = window.chrome || window.browser || {}

/**
 * Retrieve browser tabs with optional query filters while respecting user options.
 *
 * @param {Object} [queryOptions={}] - Filters passed to the tabs API.
 * @returns {Promise<Array>} Tab objects, including all valid URLs.
 */
export async function getBrowserTabs(queryOptions = {}) {
  if (ext.opts.tabsOnlyCurrentWindow) {
    queryOptions.currentWindow = true
  }
  if (browserApi.tabs) {
    return (await browserApi.tabs.query(queryOptions)).filter((el) => {
      const url = typeof el?.url === 'string' ? el.url : ''
      return !!url.trim()
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
 * @returns {Array<Object>} Standardized tab entries.
 */
export function convertBrowserTabs(chromeTabs) {
  const result = []
  const count = chromeTabs.length

  for (let i = 0; i < count; i++) {
    const el = chromeTabs[i]
    if (typeof el?.url === 'string' && el.url.trim()) {
      const cleanUrl = cleanUpUrl(el.url)
      const title = getTitle(el.title, cleanUrl)
      const titleLower = title.toLowerCase().trim()
      const searchString = createSearchString(title, cleanUrl)

      result.push({
        type: 'tab',
        title,
        titleLower: titleLower,
        url: cleanUrl,
        originalUrl: el.url.replace(URL_ROOT_CLEANUP_REGEX, ''),
        originalId: el.id,
        active: el.active,
        windowId: el.windowId,
        searchString,
        searchStringLower: searchString.toLowerCase(),
        lastVisitSecondsAgo: el.lastAccessed ? (Date.now() - el.lastAccessed) / 1000 : undefined,
      })
    }
  }

  return result
}

/**
 * Retrieve the bookmark tree from the browser API.
 *
 * @returns {Promise<Array>} Bookmark hierarchy or empty array when unsupported.
 */
export async function getBrowserBookmarks() {
  if (browserApi.bookmarks?.getTree) {
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
 * @param {Map<string, Object>} [seenByUrl] - Map to track duplicate URLs (only if duplicate detection is enabled).
 * @param {string} [folderText] - Pre-calculated folder string for search.
 * @returns {Array<Object>} Flattened bookmark entries.
 */
export function convertBrowserBookmarks(
  bookmarks,
  folderTrail = [],
  depth = 1,
  seenByUrl,
  folderText,
  result = [],
  folderLower = '',
  folderArrayLower = [],
) {
  // Build folderText and folderLower if not provided (first call)
  if (folderText === undefined && folderTrail.length > 0) {
    folderText = folderTrail.map((f) => `~${f}`).join(' ')
    folderLower = folderText.toLowerCase()
    folderArrayLower = folderTrail.map((f) => f.toLowerCase())
  } else if (folderText === undefined) {
    folderText = ''
    folderLower = ''
    folderArrayLower = []
  }

  // Only initialize seenByUrl Map if duplicate detection is enabled
  if (seenByUrl === undefined && ext.opts.detectDuplicateBookmarks) {
    seenByUrl = new Map()
  }

  const ignoreList = ext.opts.bookmarksIgnoreFolderList
  const hasIgnoreList = ignoreList?.length > 0

  for (let i = 0; i < bookmarks.length; i++) {
    const entry = bookmarks[i]

    if (entry.url) {
      let title = entry.title || ''
      let customBonusScore = 0

      // Simple check for custom bonus score "+20"
      if (title.includes(' +')) {
        const match = title.match(BONUS_SCORE_REGEX)
        if (match) {
          title = title.replace(match[0], '')
          customBonusScore = parseInt(match[1], 10)
        }
      }

      const url = entry.url.replace(URL_ROOT_CLEANUP_REGEX, '')
      const cleanedUrl = cleanUpUrl(url)

      // Parse out tags from bookmark title (starting with " #")
      let tagsText = ''
      const tagsArray = []
      if (title.includes(' #')) {
        const tagSplit = title.split(' #')
        title = tagSplit[0]

        for (let j = 1; j < tagSplit.length; j++) {
          const tag = tagSplit[j].trim()
          if (!tag) continue
          if (TAG_NUMERIC_CHECK_REGEX.test(tag)) {
            // If tag starts with a digit, it's probably not a tag (e.g. "C# 11")
            title += ` #${tag}`
          } else {
            tagsArray.push(tag)
            tagsText += `#${tag} `
          }
        }
        tagsText = tagsText.trim()
      }

      const finalTitle = getTitle(title, cleanedUrl)
      const titleLower = finalTitle.toLowerCase().trim()
      const searchString = createSearchString(finalTitle, cleanedUrl, tagsText, folderText)

      const mappedEntry = {
        type: 'bookmark',
        originalId: entry.id,
        title: finalTitle,
        titleLower: titleLower,
        originalUrl: url,
        url: cleanedUrl,
        dateAdded: entry.dateAdded,
        customBonusScore,
        tags: tagsText,
        tagsLower: tagsText.toLowerCase(),
        tagsArray: tagsArray,
        tagsArrayLower: tagsArray.map((t) => t.toLowerCase()),
        folder: folderText,
        folderLower: folderLower,
        folderArray: folderTrail,
        folderArrayLower: folderArrayLower,
        searchString: searchString,
        searchStringLower: searchString.toLowerCase(),
      }

      // Only detect duplicates if the feature is enabled
      if (seenByUrl) {
        const existingEntry = seenByUrl.get(mappedEntry.url)
        if (existingEntry) {
          existingEntry.dupe = true
          mappedEntry.dupe = true
          console.warn(
            `Duplicate bookmark detected for ${mappedEntry.originalUrl} in folder: ${mappedEntry.folderArray.join(' > ') || '/'}`,
          )
        } else {
          seenByUrl.set(mappedEntry.url, mappedEntry)
        }
      }

      result.push(mappedEntry)
    } else if (entry.children) {
      // It's a folder
      const folderTitle = entry.title
      let newFolderTrail = folderTrail
      let nextFolderText = folderText
      let nextFolderLower = folderLower
      let nextFolderArrayLower = folderArrayLower

      // Skip default chrome "system" folders at depth 1/2
      if (depth > 2 && folderTitle) {
        newFolderTrail = folderTrail.concat(folderTitle)
        const folderTitleLower = folderTitle.toLowerCase()
        nextFolderText = `${folderText ? `${folderText} ` : ''}~${folderTitle}`
        nextFolderLower = `${folderLower ? `${folderLower} ` : ''}~${folderTitleLower}`
        nextFolderArrayLower = folderArrayLower.concat(folderTitleLower)
      }

      // Check ignore list
      if (hasIgnoreList && folderTitle && ignoreList.includes(folderTitle)) {
        continue
      }

      convertBrowserBookmarks(
        entry.children,
        newFolderTrail,
        depth + 1,
        seenByUrl,
        nextFolderText,
        result,
        nextFolderLower,
        nextFolderArrayLower,
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

export function convertBrowserHistory(history) {
  const historyIgnoreList = ext.opts.historyIgnoreList
  let ignoreRegex = null
  if (historyIgnoreList?.length) {
    if (!ext.state) ext.state = {}
    if (!ext.state.historyIgnoreRegex) {
      // Filter out empty strings and escape special characters
      const cleanPatterns = historyIgnoreList
        .filter(Boolean)
        .map((str) => String(str).replace(REGEX_SPECIAL_CHARS_REGEX, '\\$&'))

      if (cleanPatterns.length > 0) {
        ext.state.historyIgnoreRegex = new RegExp(cleanPatterns.join('|'), 'i')
      } else {
        // Fallback to a regex that matches nothing
        ext.state.historyIgnoreRegex = /$.^/
      }
    }
    ignoreRegex = ext.state.historyIgnoreRegex
  }

  const result = []
  const count = history.length
  const now = Date.now()
  let ignoredHistoryCounter = 0

  for (let i = 0; i < count; i++) {
    const el = history[i]
    if (ignoreRegex?.test(el.url)) {
      ignoredHistoryCounter += 1
      continue
    }

    const cleanUrl = cleanUpUrl(el.url)
    const title = getTitle(el.title, cleanUrl)
    const titleLower = title.toLowerCase().trim()
    const searchString = createSearchString(title, cleanUrl)

    result.push({
      type: 'history',
      title,
      titleLower: titleLower,
      originalUrl: el.url.replace(URL_ROOT_CLEANUP_REGEX, ''),
      url: cleanUrl,
      visitCount: el.visitCount,
      lastVisitSecondsAgo: (now - el.lastVisitTime) / 1000,
      originalId: el.id,
      searchString,
      searchStringLower: searchString.toLowerCase(),
    })
  }

  if (ignoredHistoryCounter > 0) {
    console.debug(`Ignored ${ignoredHistoryCounter} history items due to ignore list`)
  }

  return result
}

/**
 * Combine title/url/tags/folder fields into a single search string.
 *
 * @param {string} title - Bookmark title.
 * @param {string} url - Normalized URL.
 * @param {string} [tags] - Tag string.
 * @param {string} [folder] - Folder breadcrumb string.
 * @returns {string} Combined search string.
 */
export function createSearchString(title, url, tags, folder) {
  let result = ''
  if (title && title !== url) {
    result += title
  }
  if (url) {
    result += (result ? '¦' : '') + url
  }
  if (tags) {
    result += (result ? '¦' : '') + tags
  }
  if (folder) {
    result += (result ? '¦' : '') + folder
  }
  return result
}

/**
 * Ensure bookmarks have a human-readable title, falling back to shortened URLs.
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
  const urlTitleLengthRestriction = 80
  const maxLengthRestriction = 512
  if (title && title.length > urlTitleLengthRestriction) {
    return `${title.substring(0, urlTitleLengthRestriction - 3)}...`
  } else if (title && title.length > maxLengthRestriction) {
    return `${title.substring(0, maxLengthRestriction - 3)}...`
  } else {
    return title
  }
}
