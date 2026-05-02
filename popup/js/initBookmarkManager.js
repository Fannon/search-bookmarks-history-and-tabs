/**
 * @file Coordinates the dedicated bookmark manager page.
 */

import { createSearchStringLower } from './helper/browserApi.js'
import { createExtensionContext } from './helper/extensionContext.js'
import { getLocalAiTagAvailability, suggestBookmarkTags } from './helper/localAiTags.js'
import { cleanUpUrl } from './helper/utils.js'
import { createBookmarkManagerModel } from './model/bookmarkManagerData.js'
import { getEffectiveOptions } from './model/options.js'
import { getSearchData } from './model/searchData.js'
import { calculateFinalScore, executeSearch, sortResults } from './search/common.js'
import { resetFuzzySearchState } from './search/fuzzySearch.js'
import { resetSimpleSearchState } from './search/simpleSearch.js'
import { resetUniqueFoldersCache } from './search/taxonomySearch.js'
import {
  addManagerTagInputValues,
  bindBookmarkManagerEvents,
  getBookmarkManagerDom,
  getManagedBookmarkEditValues,
  getManagerTagInputValues,
  getSelectedDuplicateIds,
  getSelectedManagedBookmarkIds,
  getVisibleManagedBookmarkIds,
  renderBookmarkManager,
  renderBookmarkWorkspace,
  setManagedBookmarkSelected,
  showLocalAiTagAvailability,
  showManagerStatus,
} from './view/bookmarkManagerView.js'
import { printError } from './view/errorView.js'

export const ext = createExtensionContext()
window.ext = ext

initBookmarkManager().catch((error) => {
  printError(error, 'Could not initialize bookmark manager.')
})

/**
 * Initialize the dedicated bookmark manager page.
 */
export async function initBookmarkManager() {
  ext.dom.manager = getBookmarkManagerDom()
  ext.opts = await getEffectiveOptions()

  // Load tabs only to enrich local AI prompts when a bookmark is already open.
  ext.opts.enableTabs = true
  ext.opts.enableHistory = false
  ext.opts.enableBookmarks = true
  ext.opts.detectDuplicateBookmarks = false
  ext.opts.bookmarksIgnoreFolderList = []
  applyManagerColors()

  bindBookmarkManagerEvents({
    onRefresh: reloadBookmarkManager,
    onDeleteSelected: deleteSelectedDuplicates,
    onDeleteOne: deleteSingleDuplicate,
    onBookmarkSearch: updateBookmarkBrowser,
    onSelectBookmark: setManagedBookmarkSelected,
    onSaveBookmark: saveManagedBookmark,
    onMoveSelected: moveSelectedBookmarks,
    onSuggestTagsSelected: suggestTagsForSelectedBookmarks,
    onSuggestTagsBookmark: suggestTagsForSingleBookmark,
    onBulkTagSelected: bulkTagSelectedBookmarks,
    onBulkTagVisible: bulkTagVisibleBookmarks,
    onRenameTag: renameTag,
    onRemoveTag: removeTag,
  })

  await reloadBookmarkManager()
  checkLocalAiTagSupport()
  ext.initialized = true
}

/**
 * Reload bookmark data and rerender the manager.
 */
export async function reloadBookmarkManager() {
  try {
    showManagerStatus('Loading bookmarks...')
    const { bookmarks, bookmarkTree } = await getSearchData()
    ext.model.bookmarks = bookmarks
    ext.model.bookmarkManager = createBookmarkManagerModel(bookmarks, bookmarkTree)
    ext.searchCache = new Map()
    ext.model.searchMode = 'bookmarks'
    ext.model.bookmarkManagerSelectedIds = new Set()
    ext.model.bookmarkManagerFolderId ||= 'all'

    renderBookmarkManager(ext.model.bookmarkManager, canModifyBookmarks(), canUpdateBookmarks())
    await updateBookmarkBrowser()
    showManagerStatus('Loaded')
  } catch (error) {
    showManagerStatus('Load failed', 'error')
    printError(error, 'Could not load bookmark manager data.')
  } finally {
    ext.dom.manager.loadingIndicator?.remove()
  }
}

async function updateBookmarkBrowser() {
  try {
    const visibleBookmarks = await getVisibleBookmarks()
    renderBookmarkWorkspace(visibleBookmarks, canUpdateBookmarks(), canMoveBookmarks())
  } catch (error) {
    showManagerStatus('Search failed', 'error')
    printError(error, 'Could not search bookmark manager data.')
  }
}

async function getVisibleBookmarks() {
  const bookmarks = ext.model.bookmarkManager?.bookmarks || []
  const searchTerm = ext.dom.manager.bookmarkSearch.value.trim().toLowerCase()
  const folderId = ext.model.bookmarkManagerFolderId || 'all'
  let results = bookmarks

  if (searchTerm) {
    results = await executeSearch(searchTerm, 'bookmarks', ext.model, ext.opts)
    results = sortResults(calculateFinalScore(results, searchTerm), 'score')
  }

  return filterBookmarksByFolder(results, folderId)
}

async function saveManagedBookmark() {
  const selectedIds = getSelectedManagedBookmarkIds()
  if (selectedIds.length !== 1 || !canUpdateBookmarks()) {
    return
  }

  const bookmarkId = selectedIds[0]
  const bookmark = findBookmarkById(bookmarkId)
  const values = getManagedBookmarkEditValues()
  if (!bookmark || !values.title || !values.url) {
    showManagerStatus('Title and URL are required.', 'error')
    return
  }

  try {
    showManagerStatus('Saving bookmark...')
    await ext.browserApi.bookmarks.update(bookmarkId, {
      title: createTaggedBookmarkTitle(values.title, values.tags),
      url: values.url,
    })
    updateBookmarkInMemory(bookmark, values.title, values.url, values.tags)
    resetBookmarkSearchCaches()
    showManagerStatus('Saved bookmark', 'success')
    await reloadBookmarkManager()
  } catch (error) {
    showManagerStatus('Save failed', 'error')
    printError(error, 'Could not save bookmark.')
  }
}

async function moveSelectedBookmarks() {
  const selectedIds = getSelectedManagedBookmarkIds()
  const parentId = ext.dom.manager.bookmarkMoveFolder.value
  if (!selectedIds.length || !parentId || !canMoveBookmarks()) {
    return
  }

  const confirmed = window.confirm(`Move ${selectedIds.length} selected bookmark(s)?`)
  if (!confirmed) {
    return
  }

  try {
    showManagerStatus('Moving bookmarks...')
    for (let i = 0; i < selectedIds.length; i++) {
      await ext.browserApi.bookmarks.move(selectedIds[i], { parentId })
    }
    showManagerStatus(`Moved ${selectedIds.length} bookmark(s)`, 'success')
    await reloadBookmarkManager()
  } catch (error) {
    showManagerStatus('Move failed', 'error')
    printError(error, 'Could not move selected bookmarks.')
  }
}

async function bulkTagSelectedBookmarks(mode) {
  const selectedIds = getSelectedManagedBookmarkIds()
  await bulkTagBookmarks(selectedIds, mode, 'selected')
}

async function bulkTagVisibleBookmarks(mode) {
  const visibleIds = getVisibleManagedBookmarkIds()
  await bulkTagBookmarks(visibleIds, mode, 'visible')
}

async function suggestTagsForSelectedBookmarks() {
  const selectedIds = getSelectedManagedBookmarkIds()
  if (!selectedIds.length) {
    return
  }

  const bookmarks = getBookmarksByIds(selectedIds)
  await suggestTagsForBookmarks(bookmarks, 'bulk')
}

async function suggestTagsForSingleBookmark() {
  const selectedIds = getSelectedManagedBookmarkIds()
  if (selectedIds.length !== 1) {
    return
  }

  const bookmark = findBookmarkById(selectedIds[0])
  if (!bookmark) {
    return
  }

  await suggestTagsForBookmarks([bookmark], 'edit')
}

async function suggestTagsForBookmarks(bookmarks, target) {
  if (!bookmarks.length) {
    return
  }

  try {
    showManagerStatus('Checking local AI...')
    const availability = await getLocalAiTagAvailability()
    showLocalAiTagAvailability(availability)

    if (availability === 'unsupported' || availability === 'unavailable') {
      showManagerStatus('Local AI unavailable', 'error')
      return
    }

    showManagerStatus(availability === 'available' ? 'Suggesting tags...' : 'Downloading local AI model...')
    const tags = await suggestBookmarkTags(bookmarks, getKnownBookmarkTags(), (progress) => {
      showManagerStatus(`Downloading local AI model ${Math.round(progress * 100)}%`)
    })

    if (!tags.length) {
      showManagerStatus('No tags suggested', 'error')
      return
    }

    addManagerTagInputValues(target, tags)
    showManagerStatus(`Suggested ${tags.length} tag(s)`, 'success')
    const nextAvailability = await getLocalAiTagAvailability()
    showLocalAiTagAvailability(nextAvailability)
  } catch (error) {
    showManagerStatus('Tag suggestion failed', 'error')
    printError(error, 'Could not suggest bookmark tags with local AI.')
  }
}

async function bulkTagBookmarks(bookmarkIds, mode, label) {
  if (!bookmarkIds.length || !canUpdateBookmarks()) {
    return
  }

  const tags = getManagerTagInputValues('bulk')
  if (!tags.length) {
    showManagerStatus('Add at least one tag.', 'error')
    return
  }

  const confirmed = window.confirm(
    `${formatBulkTagMode(mode)} ${tags.length} tag(s) on ${bookmarkIds.length} ${label} bookmark(s)?`,
  )
  if (!confirmed) {
    return
  }

  try {
    showManagerStatus('Updating tags...')
    const bookmarkIdSet = new Set(bookmarkIds.map(String))
    const bookmarks = (ext.model.bookmarkManager?.bookmarks || []).filter((bookmark) =>
      bookmarkIdSet.has(String(bookmark.originalId)),
    )
    await updateTaggedBookmarks(bookmarks, (currentTags) => mergeBulkTags(currentTags, tags, mode))
    showManagerStatus(`Updated ${bookmarkIds.length} bookmark(s)`, 'success')
    clearBulkTagInput()
    await reloadBookmarkManager()
  } catch (error) {
    showManagerStatus('Tag update failed', 'error')
    printError(error, 'Could not update bookmark tags.')
  }
}

async function deleteSelectedDuplicates() {
  const selectedIds = getSelectedDuplicateIds()

  if (!selectedIds.length || !canModifyBookmarks()) {
    return
  }
  if (selectionRemovesWholeDuplicateGroup(selectedIds)) {
    showManagerStatus('Leave at least one bookmark in every duplicate group.', 'error')
    return
  }

  const confirmed = window.confirm(`Delete ${selectedIds.length} selected duplicate bookmark(s)?`)
  if (!confirmed) {
    return
  }

  try {
    showManagerStatus('Deleting duplicates...')
    for (let i = 0; i < selectedIds.length; i++) {
      await ext.browserApi.bookmarks.remove(selectedIds[i])
    }

    showManagerStatus(`Deleted ${selectedIds.length} bookmark(s)`, 'success')
    await reloadBookmarkManager()
  } catch (error) {
    showManagerStatus('Delete failed', 'error')
    printError(error, 'Could not delete selected duplicate bookmarks.')
  }
}

async function deleteSingleDuplicate(bookmarkId) {
  if (!bookmarkId || !canModifyBookmarks()) {
    return
  }

  const confirmed = window.confirm('Delete this bookmark?')
  if (!confirmed) {
    return
  }

  try {
    showManagerStatus('Deleting bookmark...')
    await ext.browserApi.bookmarks.remove(bookmarkId)
    showManagerStatus('Deleted bookmark', 'success')
    await reloadBookmarkManager()
  } catch (error) {
    showManagerStatus('Delete failed', 'error')
    printError(error, 'Could not delete bookmark.')
  }
}

async function renameTag(oldTag) {
  if (!oldTag || !canUpdateBookmarks()) {
    return
  }

  const newTag = normalizeTagName(window.prompt(`Rename tag "#${oldTag}" to:`, oldTag))
  if (!newTag || newTag === oldTag) {
    return
  }

  const bookmarks = getBookmarksWithTag(oldTag)
  if (!bookmarks.length) {
    showManagerStatus('Tag not found', 'error')
    return
  }

  const confirmed = window.confirm(`Rename "#${oldTag}" to "#${newTag}" on ${bookmarks.length} bookmark(s)?`)
  if (!confirmed) {
    return
  }

  try {
    showManagerStatus('Renaming tag...')
    await updateTaggedBookmarks(bookmarks, (tags) => uniqueTags(tags.map((tag) => (tag === oldTag ? newTag : tag))))
    showManagerStatus(`Renamed #${oldTag}`, 'success')
    await reloadBookmarkManager()
  } catch (error) {
    showManagerStatus('Rename failed', 'error')
    printError(error, 'Could not rename bookmark tag.')
  }
}

async function removeTag(tagName) {
  if (!tagName || !canUpdateBookmarks()) {
    return
  }

  const bookmarks = getBookmarksWithTag(tagName)
  if (!bookmarks.length) {
    showManagerStatus('Tag not found', 'error')
    return
  }

  const confirmed = window.confirm(`Remove "#${tagName}" from ${bookmarks.length} bookmark(s)?`)
  if (!confirmed) {
    return
  }

  try {
    showManagerStatus('Removing tag...')
    await updateTaggedBookmarks(bookmarks, (tags) => tags.filter((tag) => tag !== tagName))
    showManagerStatus(`Removed #${tagName}`, 'success')
    await reloadBookmarkManager()
  } catch (error) {
    showManagerStatus('Remove failed', 'error')
    printError(error, 'Could not remove bookmark tag.')
  }
}

function canModifyBookmarks() {
  return typeof ext.browserApi.bookmarks?.remove === 'function'
}

function canUpdateBookmarks() {
  return typeof ext.browserApi.bookmarks?.update === 'function'
}

function canMoveBookmarks() {
  return typeof ext.browserApi.bookmarks?.move === 'function'
}

async function checkLocalAiTagSupport() {
  const availability = await getLocalAiTagAvailability()
  showLocalAiTagAvailability(availability)
  await updateBookmarkBrowser()
}

function filterBookmarksByFolder(bookmarks, folderId) {
  if (!folderId || folderId === 'all') {
    return bookmarks
  }

  const folder = findFolderById(ext.model.bookmarkManager?.folderTree, folderId)
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

function collectFolderIds(folder) {
  const folderIds = new Set([String(folder.id)])

  for (let i = 0; i < folder.children.length; i++) {
    const childIds = collectFolderIds(folder.children[i])
    for (const childId of childIds) {
      folderIds.add(childId)
    }
  }

  return folderIds
}

function findBookmarkById(bookmarkId) {
  const bookmarks = ext.model.bookmarkManager?.bookmarks || []
  for (let i = 0; i < bookmarks.length; i++) {
    if (String(bookmarks[i].originalId) === String(bookmarkId)) {
      return bookmarks[i]
    }
  }
  return null
}

function getBookmarksByIds(bookmarkIds) {
  const bookmarkIdSet = new Set(bookmarkIds.map(String))
  const bookmarks = ext.model.bookmarkManager?.bookmarks || []
  return bookmarks.filter((bookmark) => bookmarkIdSet.has(String(bookmark.originalId)))
}

function getKnownBookmarkTags() {
  const tagGroups = ext.model.bookmarkManager?.tagGroups || []
  const tags = new Array(tagGroups.length)
  for (let i = 0; i < tagGroups.length; i++) {
    tags[i] = tagGroups[i].name
  }
  return tags
}

function findFolderById(folder, folderId) {
  if (!folder) {
    return null
  }
  if (String(folder.id) === String(folderId)) {
    return folder
  }

  for (let i = 0; i < folder.children.length; i++) {
    const match = findFolderById(folder.children[i], folderId)
    if (match) {
      return match
    }
  }

  return null
}

function getBookmarksWithTag(tagName) {
  const bookmarks = ext.model.bookmarkManager?.bookmarks || []
  return bookmarks.filter((bookmark) => bookmark.tagsArray?.includes(tagName))
}

async function updateTaggedBookmarks(bookmarks, getNextTags) {
  for (let i = 0; i < bookmarks.length; i++) {
    const bookmark = bookmarks[i]
    const nextTags = getNextTags(bookmark.tagsArray || [])
    await ext.browserApi.bookmarks.update(String(bookmark.originalId), {
      title: createTaggedBookmarkTitle(bookmark.title, nextTags),
    })
  }
}

function createTaggedBookmarkTitle(title, tags) {
  const titleText = String(title || '').trim()
  const tagsText = tags.length ? `#${tags.join(' #')}` : ''
  return `${titleText}${tagsText ? ` ${tagsText}` : ''}`.trim()
}

function updateBookmarkInMemory(bookmark, title, url, tags) {
  bookmark.title = title
  bookmark.titleLower = title.toLowerCase().trim()
  bookmark.originalUrl = url
  bookmark.url = cleanUpUrl(url)
  bookmark.tagsArray = tags
  bookmark.tagsArrayLower = tags.map((tag) => tag.toLowerCase())
  bookmark.tags = tags.length ? `#${tags.join(' #')}` : ''
  bookmark.tagsLower = bookmark.tags.toLowerCase()
  bookmark.searchStringLower = createSearchStringLower(bookmark.title, bookmark.url, bookmark.tags, bookmark.folder)
}

function resetBookmarkSearchCaches() {
  resetFuzzySearchState('bookmarks')
  resetSimpleSearchState('bookmarks')
  resetUniqueFoldersCache()
  ext.searchCache?.clear()
}

function mergeBulkTags(currentTags, nextTags, mode) {
  if (mode === 'replace') {
    return nextTags
  }
  if (mode === 'remove') {
    const removeSet = new Set(nextTags.map((tag) => tag.toLowerCase()))
    return currentTags.filter((tag) => !removeSet.has(tag.toLowerCase()))
  }
  return uniqueTags(currentTags.concat(nextTags))
}

function formatBulkTagMode(mode) {
  if (mode === 'replace') {
    return 'Replace with'
  }
  if (mode === 'remove') {
    return 'Remove'
  }
  return 'Add'
}

function clearBulkTagInput() {
  if (ext.managerBulkTagify) {
    ext.managerBulkTagify.removeAllTags()
    return
  }
  ext.dom.manager.bulkTagsInput.value = ''
}

function normalizeTagName(tagName) {
  return String(tagName || '')
    .replaceAll('#', '')
    .replace(/\s+/g, ' ')
    .trim()
}

function uniqueTags(tags) {
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

function applyManagerColors() {
  const rootStyle = document.documentElement.style
  rootStyle.setProperty('--bookmark-color', ext.opts.bookmarkColor || '#3c8d8d')
  rootStyle.setProperty('--badge-folder', ext.opts.bookmarkColor || '#3c8d8d')
  rootStyle.setProperty('--tab-color', ext.opts.tabColor || '#b89aff')
  rootStyle.setProperty('--history-color', ext.opts.historyColor || '#9ece2f')
}

function selectionRemovesWholeDuplicateGroup(selectedIds) {
  const selectedIdSet = new Set(selectedIds)
  const duplicateGroups = ext.model.bookmarkManager?.duplicateGroups || []

  for (let i = 0; i < duplicateGroups.length; i++) {
    const bookmarks = duplicateGroups[i].bookmarks
    let selectedCount = 0

    for (let j = 0; j < bookmarks.length; j++) {
      if (selectedIdSet.has(String(bookmarks[j].originalId))) {
        selectedCount += 1
      }
    }

    if (selectedCount === bookmarks.length) {
      return true
    }
  }

  return false
}
