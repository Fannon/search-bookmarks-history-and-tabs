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
 * @param {Array<Object>} bookmarkTree Raw browser bookmark tree.
 * @returns {{bookmarks: Array<Object>, duplicateGroups: Array<Object>, folderTree: Object, folderOptions: Array<Object>, tagGroups: Array<Object>, stats: Object}}
 */
export function createBookmarkManagerModel(bookmarks = [], bookmarkTree = []) {
  const duplicateGroups = getDuplicateGroups(bookmarks)
  const tagGroups = getTagGroups(bookmarks)
  const folderTree = getFolderTree(bookmarkTree, bookmarks)
  const folderOptions = getFolderOptions(folderTree)
  const stats = getBookmarkStats(bookmarks, duplicateGroups, folderOptions)

  return {
    bookmarks,
    duplicateGroups,
    folderTree,
    folderOptions,
    tagGroups,
    stats,
  }
}

/**
 * Build a folder tree from the raw browser tree, falling back to normalized bookmark paths.
 *
 * @param {Array<Object>} bookmarkTree Raw browser bookmark tree.
 * @param {Array<Object>} bookmarks Normalized bookmark entries.
 * @returns {Object} Tree root with folder children.
 */
export function getFolderTree(bookmarkTree = [], bookmarks = []) {
  const root = createFolderNode('all', 'All Bookmarks', '', [], 0)

  if (bookmarkTree.length) {
    addRawFolderChildren(root, bookmarkTree, [], 1)
  }

  if (!root.children.length && bookmarks.length) {
    addBookmarkPathFolders(root, bookmarks)
  }

  sortFolderTree(root)
  return root
}

/**
 * Flatten a folder tree into move-target options.
 *
 * @param {Object} folderTree Folder tree root.
 * @returns {Array<Object>} Folder options.
 */
export function getFolderOptions(folderTree) {
  const options = []
  collectFolderOptions(folderTree, options)
  return options
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
 * @param {Array<Object>} folderOptions Folder options with labels and ids.
 * @returns {Object} Aggregate statistics.
 */
export function getBookmarkStats(bookmarks = [], duplicateGroups = [], folderOptions = []) {
  const tagCounts = new Map()
  const domainCounts = new Map()
  const folderCounts = new Map()
  const folderIdsByLabel = getFolderIdsByLabel(folderOptions)
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
    incrementFolderCount(folderCounts, bookmark, folderIdsByLabel)

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

function createFolderNode(id, title, parentId, path, depth) {
  return {
    id: String(id || ''),
    title: String(title || 'Untitled Folder'),
    parentId: parentId ? String(parentId) : '',
    path,
    depth,
    count: 0,
    totalCount: 0,
    children: [],
  }
}

function addRawFolderChildren(parent, entries, path, depth) {
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    if (!entry?.children) {
      parent.count += 1
      continue
    }

    const includeFolder = depth > 1 && entry.title
    const nextPath = includeFolder ? path.concat(entry.title) : path
    const child = includeFolder
      ? createFolderNode(entry.id, entry.title, entry.parentId, nextPath, parent.depth + 1)
      : parent

    addRawFolderChildren(child, entry.children, nextPath, depth + 1)

    if (includeFolder) {
      parent.children.push(child)
    }
  }
}

function addBookmarkPathFolders(root, bookmarks) {
  const childrenByKey = new Map()

  for (let i = 0; i < bookmarks.length; i++) {
    const bookmark = bookmarks[i]
    const path = bookmark.folderArray || []
    let parent = root
    let pathKey = ''

    for (let j = 0; j < path.length; j++) {
      const title = path[j]
      pathKey = pathKey ? `${pathKey}/${title}` : title
      let child = childrenByKey.get(pathKey)

      if (!child) {
        child = createFolderNode(bookmark.folderId || pathKey, title, parent.id, path.slice(0, j + 1), parent.depth + 1)
        childrenByKey.set(pathKey, child)
        parent.children.push(child)
      }

      parent = child
    }

    parent.count += 1
  }
}

function sortFolderTree(folder) {
  let totalCount = folder.count
  folder.children.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))

  for (let i = 0; i < folder.children.length; i++) {
    totalCount += sortFolderTree(folder.children[i])
  }

  folder.totalCount = totalCount
  return totalCount
}

function collectFolderOptions(folder, options) {
  if (folder.id && folder.id !== 'all') {
    options.push({
      id: folder.id,
      title: folder.title,
      label: folder.path.length ? folder.path.join(' / ') : folder.title,
      depth: folder.depth,
    })
  }

  for (let i = 0; i < folder.children.length; i++) {
    collectFolderOptions(folder.children[i], options)
  }
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

function incrementFolderCount(map, bookmark, folderIdsByLabel) {
  const name = getFolderLabel(bookmark.folderArray)
  const id = bookmark.folderId || folderIdsByLabel.get(name.toLowerCase()) || ''
  const key = name.toLowerCase()
  const current = map.get(key)

  if (current) {
    current.count += 1
  } else {
    map.set(key, {
      name,
      id,
      count: 1,
    })
  }
}

function getFolderIdsByLabel(folderOptions) {
  const result = new Map()

  for (let i = 0; i < folderOptions.length; i++) {
    const folder = folderOptions[i]
    const label = String(folder.label || '').trim()

    if (label) {
      result.set(label.toLowerCase(), folder.id)
    }
  }

  return result
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
