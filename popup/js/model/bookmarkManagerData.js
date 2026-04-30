/**
 * @file Builds aggregate bookmark manager data from normalized bookmark entries.
 */

const TOP_LIST_LIMIT = 8
const UNKNOWN_DOMAIN = 'Unknown'
const LONG_TITLE_LENGTH = 80

/**
 * Create the data model consumed by the bookmark manager view.
 *
 * @param {Array<Object>} bookmarks Normalized bookmark entries.
 * @returns {{bookmarks: Array<Object>, duplicateGroups: Array<Object>, tagGroups: Array<Object>, stats: Object}}
 */
export function createBookmarkManagerModel(bookmarks = []) {
  const duplicateGroups = getDuplicateGroups(bookmarks)
  const tagGroups = getTagGroups(bookmarks)
  const stats = getBookmarkStats(bookmarks, duplicateGroups)

  return {
    bookmarks,
    duplicateGroups,
    tagGroups,
    stats,
  }
}

/**
 * Group bookmarks by normalized URL and keep only groups with duplicates.
 *
 * @param {Array<Object>} bookmarks Normalized bookmark entries.
 * @returns {Array<Object>} Duplicate URL groups.
 */
export function getDuplicateGroups(bookmarks = []) {
  const bookmarksByUrl = new Map()

  for (let i = 0; i < bookmarks.length; i++) {
    const bookmark = bookmarks[i]
    const url = bookmark?.url || bookmark?.originalUrl
    if (!url) {
      continue
    }

    let group = bookmarksByUrl.get(url)
    if (!group) {
      group = []
      bookmarksByUrl.set(url, group)
    }
    group.push(bookmark)
  }

  const duplicateGroups = []
  for (const [url, group] of bookmarksByUrl) {
    if (group.length < 2) {
      continue
    }

    const sortedBookmarks = group.map(addDuplicateScore).sort(compareKeepCandidates)
    const suggestedBookmarks = addDuplicateSuggestions(sortedBookmarks)
    duplicateGroups.push({
      url,
      displayUrl: suggestedBookmarks[0].originalUrl || suggestedBookmarks[0].url || url,
      keepId: String(suggestedBookmarks[0].originalId),
      count: suggestedBookmarks.length,
      bookmarks: suggestedBookmarks,
    })
  }

  duplicateGroups.sort((a, b) => {
    if (a.count !== b.count) {
      return b.count - a.count
    }
    return a.displayUrl.localeCompare(b.displayUrl, undefined, { sensitivity: 'base' })
  })

  return duplicateGroups
}

/**
 * Calculate overview statistics for bookmark collections.
 *
 * @param {Array<Object>} bookmarks Normalized bookmark entries.
 * @param {Array<Object>} duplicateGroups Duplicate URL groups.
 * @returns {Object} Aggregate statistics.
 */
export function getBookmarkStats(bookmarks = [], duplicateGroups = []) {
  const tagCounts = new Map()
  const domainCounts = new Map()
  const folderCounts = new Map()
  const bookmarkCount = bookmarks.length
  let taggedBookmarkCount = 0
  let tagAssignmentCount = 0
  let oldestDateAdded = Infinity
  let newestDateAdded = 0
  let missingDateCount = 0
  let titleLooksLikeUrlCount = 0

  for (let i = 0; i < bookmarkCount; i++) {
    const bookmark = bookmarks[i]
    const tags = bookmark.tagsArray || []

    if (tags.length > 0) {
      taggedBookmarkCount += 1
      tagAssignmentCount += tags.length
    }

    for (let j = 0; j < tags.length; j++) {
      incrementNamedCount(tagCounts, tags[j])
    }

    incrementNamedCount(domainCounts, getDomainLabel(bookmark.originalUrl || bookmark.url))
    incrementNamedCount(folderCounts, getFolderLabel(bookmark.folderArray))

    if (Number.isFinite(bookmark.dateAdded)) {
      if (bookmark.dateAdded < oldestDateAdded) {
        oldestDateAdded = bookmark.dateAdded
      }
      if (bookmark.dateAdded > newestDateAdded) {
        newestDateAdded = bookmark.dateAdded
      }
    } else {
      missingDateCount += 1
    }

    if (bookmark.title && bookmark.url && bookmark.title.toLowerCase() === bookmark.url.toLowerCase()) {
      titleLooksLikeUrlCount += 1
    }
  }

  const duplicateBookmarkCount = duplicateGroups.reduce((sum, group) => sum + group.count, 0)

  return {
    bookmarkCount,
    taggedBookmarkCount,
    untaggedBookmarkCount: bookmarkCount - taggedBookmarkCount,
    uniqueTagCount: tagCounts.size,
    tagAssignmentCount,
    averageTagsPerBookmark: bookmarkCount ? tagAssignmentCount / bookmarkCount : 0,
    averageTagsPerTaggedBookmark: taggedBookmarkCount ? tagAssignmentCount / taggedBookmarkCount : 0,
    duplicateGroupCount: duplicateGroups.length,
    duplicateBookmarkCount,
    removableDuplicateCount: duplicateBookmarkCount - duplicateGroups.length,
    uniqueDomainCount: domainCounts.size,
    folderCount: folderCounts.size,
    averageBookmarksPerFolder: folderCounts.size ? bookmarkCount / folderCounts.size : 0,
    missingDateCount,
    titleLooksLikeUrlCount,
    oldestDateAdded: Number.isFinite(oldestDateAdded) ? oldestDateAdded : undefined,
    newestDateAdded: newestDateAdded || undefined,
    topTags: getTopCounts(tagCounts),
    topDomains: getTopCounts(domainCounts),
    topFolders: getTopCounts(folderCounts),
  }
}

/**
 * Group bookmarks by exact tag name for tag management.
 *
 * @param {Array<Object>} bookmarks Normalized bookmark entries.
 * @returns {Array<Object>} Tag groups with associated bookmark ids.
 */
export function getTagGroups(bookmarks = []) {
  const groupsByTag = new Map()

  for (let i = 0; i < bookmarks.length; i++) {
    const bookmark = bookmarks[i]
    const tags = bookmark.tagsArray || []

    for (let j = 0; j < tags.length; j++) {
      const tag = tags[j]
      const key = tag
      let group = groupsByTag.get(key)

      if (!group) {
        group = {
          name: tag,
          count: 0,
          bookmarkIds: [],
        }
        groupsByTag.set(key, group)
      }

      group.count += 1
      group.bookmarkIds.push(String(bookmark.originalId))
    }
  }

  return [...groupsByTag.values()].sort((a, b) => {
    if (a.count !== b.count) {
      return b.count - a.count
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
}

function compareKeepCandidates(a, b) {
  const aScore = a.duplicateScore || getDuplicateCandidateScore(a)
  const bScore = b.duplicateScore || getDuplicateCandidateScore(b)

  const tagDiff = bScore.tagCount - aScore.tagCount
  if (tagDiff !== 0) {
    return tagDiff
  }

  const titleDiff = bScore.titleQuality - aScore.titleQuality
  if (titleDiff !== 0) {
    return titleDiff
  }

  const aDate = Number.isFinite(a.dateAdded) ? a.dateAdded : 0
  const bDate = Number.isFinite(b.dateAdded) ? b.dateAdded : 0
  if (aDate !== bDate) {
    return bDate - aDate
  }

  const folderDiff = bScore.folderDepth - aScore.folderDepth
  if (folderDiff !== 0) {
    return folderDiff
  }

  return String(a.originalId).localeCompare(String(b.originalId), undefined, { numeric: true })
}

function addDuplicateScore(bookmark) {
  return {
    ...bookmark,
    duplicateScore: getDuplicateCandidateScore(bookmark),
  }
}

function addDuplicateSuggestions(sortedBookmarks) {
  const bestBookmark = sortedBookmarks[0]
  return sortedBookmarks.map((bookmark, index) => ({
    ...bookmark,
    duplicateSuggestion: {
      recommended: index === 0,
      label: index === 0 ? 'Best candidate' : 'Lower-ranked copy',
      detail: index === 0 ? getBestCandidateDetail(bookmark) : getLowerCandidateDetail(bookmark, bestBookmark),
    },
  }))
}

function getDuplicateCandidateScore(bookmark) {
  return {
    tagCount: bookmark.tagsArray?.length || 0,
    titleQuality: getTitleQuality(bookmark),
    folderDepth: bookmark.folderArray?.length || 0,
  }
}

function getTitleQuality(bookmark) {
  const title = String(bookmark.title || '').trim()
  if (!title || titleLooksLikeUrl(bookmark, title)) {
    return 0
  }

  return title.length > LONG_TITLE_LENGTH ? 1 : 2
}

function titleLooksLikeUrl(bookmark, title) {
  const normalizedTitle = normalizeTitle(title)
  const url = String(bookmark.url || '').toLowerCase()
  const originalUrl = String(bookmark.originalUrl || '').toLowerCase()

  return (
    normalizedTitle === url ||
    normalizedTitle === originalUrl ||
    /^(?:https?:\/\/|www\.|[a-z0-9.-]+\.[a-z]{2,})(?:\/|$)/i.test(title)
  )
}

function normalizeTitle(title) {
  return title.toLowerCase().replace(/\s+/g, ' ').trim()
}

function getBestCandidateDetail(bookmark) {
  const score = bookmark.duplicateScore
  return `Scored by ${formatTagSignal(score.tagCount)}, ${formatTitleSignal(score.titleQuality)}; newest date breaks ties.`
}

function getLowerCandidateDetail(bookmark, bestBookmark) {
  const score = bookmark.duplicateScore
  const bestScore = bestBookmark.duplicateScore
  const reasons = []

  if (score.tagCount < bestScore.tagCount) {
    reasons.push('fewer tags')
  }
  if (score.titleQuality < bestScore.titleQuality) {
    reasons.push('weaker title')
  }

  const bookmarkDate = Number.isFinite(bookmark.dateAdded) ? bookmark.dateAdded : 0
  const bestDate = Number.isFinite(bestBookmark.dateAdded) ? bestBookmark.dateAdded : 0
  if (bookmarkDate < bestDate) {
    reasons.push('older date')
  }
  if (score.folderDepth < bestScore.folderDepth) {
    reasons.push('shallower folder')
  }

  if (!reasons.length) {
    reasons.push('lower tie-break score')
  }

  return `Lower score because of ${reasons.join(', ')}.`
}

function formatTagSignal(tagCount) {
  return `${tagCount} ${tagCount === 1 ? 'tag' : 'tags'}`
}

function formatTitleSignal(titleQuality) {
  if (titleQuality === 2) {
    return 'clean title'
  }
  if (titleQuality === 1) {
    return 'long title'
  }
  return 'URL-like title'
}

function incrementNamedCount(map, name) {
  const displayName = String(name || '').trim() || UNKNOWN_DOMAIN
  const key = displayName.toLowerCase()
  const current = map.get(key)

  if (current) {
    current.count += 1
  } else {
    map.set(key, {
      name: displayName,
      count: 1,
    })
  }
}

function getDomainLabel(url) {
  if (!url) {
    return UNKNOWN_DOMAIN
  }

  try {
    const parsedUrl = new URL(url)
    const hostname = parsedUrl.hostname.replace(/^www\./, '')

    if (hostname) {
      return hostname
    }

    return parsedUrl.protocol ? parsedUrl.protocol.replace(':', '') : UNKNOWN_DOMAIN
  } catch (_error) {
    return UNKNOWN_DOMAIN
  }
}

function getFolderLabel(folderArray) {
  if (!folderArray || folderArray.length === 0) {
    return 'Root'
  }
  return folderArray.join(' / ')
}

function getTopCounts(countMap) {
  return [...countMap.values()]
    .sort((a, b) => {
      if (a.count !== b.count) {
        return b.count - a.count
      }
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })
    .slice(0, TOP_LIST_LIMIT)
}
