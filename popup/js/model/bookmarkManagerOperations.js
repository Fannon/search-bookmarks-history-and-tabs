/**
 * @file Shared bookmark-manager operations that do not touch the DOM.
 */

/**
 * Find a normalized bookmark by browser bookmark id.
 *
 * @param {Array<Object>} bookmarks Normalized bookmarks.
 * @param {string|number} bookmarkId Browser bookmark id.
 * @returns {Object|null} Matching bookmark.
 */
export function findBookmarkById(bookmarks = [], bookmarkId) {
  for (let i = 0; i < bookmarks.length; i++) {
    if (String(bookmarks[i].originalId) === String(bookmarkId)) {
      return bookmarks[i]
    }
  }
  return null
}

/**
 * Find a folder node within the bookmark manager folder tree.
 *
 * @param {Object|null} folder Folder node to search from.
 * @param {string|number} folderId Folder id.
 * @returns {Object|null} Matching folder.
 */
export function findFolderById(folder, folderId) {
  if (!folder) {
    return null
  }
  if (String(folder.id) === String(folderId)) {
    return folder
  }

  const children = folder.children || []
  for (let i = 0; i < children.length; i++) {
    const match = findFolderById(children[i], folderId)
    if (match) {
      return match
    }
  }

  return null
}

/**
 * Resolve the best folder id for opening a bookmark in the manager browser.
 *
 * Browser folder ids are preferred, but path matching covers preview/mock data
 * where only normalized folder labels are available.
 *
 * @param {Object} managerModel Bookmark manager model.
 * @param {Object} bookmark Normalized bookmark.
 * @returns {string} Folder id.
 */
export function getMostPreciseBookmarkFolderId(managerModel, bookmark) {
  const folder = findMostPreciseBookmarkFolder(managerModel?.folderTree, bookmark)
  return folder?.id || bookmark?.folderId || 'all'
}

/**
 * Filter bookmarks to a folder and its descendants.
 *
 * @param {Array<Object>} bookmarks Normalized bookmarks.
 * @param {Object} folderTree Bookmark folder tree.
 * @param {string} folderId Folder id.
 * @returns {Array<Object>} Filtered bookmarks.
 */
export function filterBookmarksByFolder(bookmarks = [], folderTree, folderId) {
  if (!folderId || folderId === 'all') {
    return bookmarks
  }

  const folder = findFolderById(folderTree, folderId)
  if (!folder) {
    return bookmarks
  }

  const folderIds = collectFolderIds(folder)
  const folderPath = folder.path || []
  const folderPathLength = folderPath.length

  return bookmarks.filter((bookmark) => {
    if (folderIds.has(String(bookmark.folderId))) {
      return true
    }

    const bookmarkPath = bookmark.folderArray || []
    if (bookmarkPath.length < folderPathLength) {
      return false
    }

    for (let i = 0; i < folderPathLength; i++) {
      if (bookmarkPath[i] !== folderPath[i]) {
        return false
      }
    }

    return true
  })
}

/**
 * Decide whether the single-bookmark edit form should be enabled.
 *
 * Checked bookmarks are bulk-action targets. The edit form is editable only
 * when no checkbox selection exists, or when the current bookmark is the one
 * checked item.
 *
 * @param {Object|null} currentBookmark Current bookmark.
 * @param {Array<string>} selectedIds Checked bookmark ids.
 * @param {boolean} canUpdateBookmarks Whether bookmark updates are available.
 * @returns {boolean} Whether the current bookmark can be edited.
 */
export function canEditCurrentManagedBookmark(currentBookmark, selectedIds = [], canUpdateBookmarks) {
  if (!currentBookmark || !canUpdateBookmarks) {
    return false
  }

  if (!selectedIds.length) {
    return true
  }

  return selectedIds.length === 1 && String(selectedIds[0]) === String(currentBookmark.originalId)
}

/**
 * Build a bookmark title with inline hashtag metadata.
 *
 * @param {string} title Bookmark title without tags.
 * @param {Array<string>} tags Tags to append.
 * @returns {string} Tagged bookmark title.
 */
export function createTaggedBookmarkTitle(title, tags = []) {
  const titleText = String(title || '').trim()
  const tagsText = tags.length ? `#${tags.join(' #')}` : ''
  return `${titleText}${tagsText ? ` ${tagsText}` : ''}`.trim()
}

/**
 * Apply a bulk tag operation.
 *
 * @param {Array<string>} currentTags Current bookmark tags.
 * @param {Array<string>} nextTags Input tags.
 * @param {'add'|'replace'|'remove'} mode Bulk operation mode.
 * @returns {Array<string>} Updated tags.
 */
export function mergeBulkTags(currentTags = [], nextTags = [], mode) {
  if (mode === 'replace') {
    return nextTags
  }
  if (mode === 'remove') {
    const removeSet = new Set(nextTags.map((tag) => tag.toLowerCase()))
    return currentTags.filter((tag) => !removeSet.has(tag.toLowerCase()))
  }
  return uniqueTags(currentTags.concat(nextTags))
}

/**
 * Normalize a single user-entered tag.
 *
 * @param {string} tagName Raw tag.
 * @returns {string} Normalized tag.
 */
export function normalizeTagName(tagName) {
  return String(tagName || '')
    .replaceAll('#', '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Return tags shared by all provided bookmarks, preserving first-bookmark casing.
 *
 * @param {Array<Object>} bookmarks Normalized bookmarks.
 * @returns {Array<string>} Common tags.
 */
export function getCommonTags(bookmarks = []) {
  if (!bookmarks.length) {
    return []
  }

  const firstTags = bookmarks[0].tagsArray || []
  const originalCasing = new Map(firstTags.map((tag) => [tag.toLowerCase(), tag]))
  const tagSets = new Array(bookmarks.length)

  for (let i = 0; i < bookmarks.length; i++) {
    const tags = bookmarks[i].tagsArray || []
    tagSets[i] = new Set(tags.map((tag) => tag.toLowerCase()))
  }

  const result = []
  const firstSet = tagSets[0]

  for (const tag of firstSet) {
    let common = true
    for (let i = 1; i < tagSets.length; i++) {
      if (!tagSets[i].has(tag)) {
        common = false
        break
      }
    }
    if (common) {
      result.push(originalCasing.get(tag) || tag)
    }
  }

  return result
}

/**
 * Remove empty and case-insensitive duplicate tags.
 *
 * @param {Array<string>} tags Tag names.
 * @returns {Array<string>} Unique tags.
 */
export function uniqueTags(tags = []) {
  const seen = new Set()
  const result = []

  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i]
    const key = tag.toLowerCase()
    if (!tag || seen.has(key)) {
      continue
    }
    seen.add(key)
    result.push(tag)
  }

  return result
}

function findMostPreciseBookmarkFolder(folderTree, bookmark) {
  const directFolder = bookmark?.folderId ? findFolderById(folderTree, bookmark.folderId) : null
  const pathFolder = findDeepestFolderByPath(folderTree, bookmark?.folderArray || [])

  if (directFolder && pathFolder) {
    return (pathFolder.path || []).length > (directFolder.path || []).length ? pathFolder : directFolder
  }

  return directFolder || pathFolder
}

function findDeepestFolderByPath(folder, path) {
  if (!folder || !path.length) {
    return null
  }

  let bestMatch = pathMatchesFolder(folder.path || [], path) ? folder : null
  const children = folder.children || []

  for (let i = 0; i < children.length; i++) {
    const childMatch = findDeepestFolderByPath(children[i], path)
    if (childMatch && (!bestMatch || childMatch.path.length > bestMatch.path.length)) {
      bestMatch = childMatch
    }
  }

  return bestMatch
}

function pathMatchesFolder(folderPath, bookmarkPath) {
  if (!folderPath.length || folderPath.length > bookmarkPath.length) {
    return false
  }

  for (let i = 0; i < folderPath.length; i++) {
    if (folderPath[i] !== bookmarkPath[i]) {
      return false
    }
  }

  return true
}

function collectFolderIds(folder) {
  const folderIds = new Set([String(folder.id)])
  const children = folder.children || []

  for (let i = 0; i < children.length; i++) {
    const childIds = collectFolderIds(children[i])
    for (const childId of childIds) {
      folderIds.add(childId)
    }
  }

  return folderIds
}
