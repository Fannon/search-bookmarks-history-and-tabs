/**
 * @file Coordinates the dedicated bookmark manager page.
 */

import { createSearchStringLower } from './helper/browserApi.js'
import { createExtensionContext } from './helper/extensionContext.js'
import { getLocalAiTagAvailability, suggestBookmarkTags } from './helper/localAiTags.js'
import { cleanUpUrl } from './helper/utils.js'
import { createBookmarkManagerModel } from './model/bookmarkManagerData.js'
import {
  createTaggedBookmarkTitle,
  filterBookmarksByFolder,
  findBookmarkById,
  findFolderById,
  getCommonTags,
  getMostPreciseBookmarkFolderId,
  mergeBulkTags,
  normalizeTagName,
  uniqueTags,
} from './model/bookmarkManagerOperations.js'
import { getEffectiveOptions } from './model/options.js'
import { getSearchData } from './model/searchData.js'
import { calculateFinalScore, executeSearch, sortResults } from './search/common.js'
import { resetFuzzySearchState } from './search/fuzzySearch.js'
import { resetSimpleSearchState } from './search/simpleSearch.js'
import { resetUniqueFoldersCache } from './search/taxonomySearch.js'
import {
  addManagerTagInputValues,
  bindBookmarkManagerEvents,
  clearManagerSuggestedTags,
  getBookmarkManagerDom,
  getCurrentManagedBookmarkId,
  getManagedActionTargetIds,
  getManagedBookmarkEditValues,
  getManagerTagInputValues,
  getSelectedDuplicateIds,
  renderActiveManagerScreen,
  renderBookmarkManager,
  renderBookmarkWorkspace,
  setManagedBookmarkSelected,
  showLocalAiTagAvailability,
  showManagerStatus,
  showTagSuggestionBusy,
  showTagSuggestionStatus,
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
    onBulkTagSelected: bulkTagSelectedBookmarks,
    onRenameTag: renameTag,
    onRemoveTag: removeTag,
    onOpenBookmark: openBookmarkInManager,
    onBookmarkNavigation: writeBookmarkBrowserUrl,
  })

  await reloadBookmarkManager()
  checkLocalAiTagSupport()
  ext.initialized = true
}

/**
 * Reload bookmark data and rerender the manager.
 *
 * @param {Object} [options] Reload options.
 * @param {boolean} [options.preserveBookmarkSelection=false] Keep the current bookmark action target.
 */
export async function reloadBookmarkManager(options = {}) {
  const preservedSelection = options.preserveBookmarkSelection ? getBookmarkSelectionState() : null

  try {
    showManagerStatus('Loading bookmarks...')
    const { bookmarks, bookmarkTree } = await getSearchData()
    ext.model.bookmarks = bookmarks
    ext.model.bookmarkManager = createBookmarkManagerModel(bookmarks, bookmarkTree)
    ext.searchCache = new Map()
    ext.model.searchMode = 'bookmarks'
    resetBookmarkSearchCaches()
    ext.model.bookmarkManagerSelectedIds = new Set()
    ext.model.bookmarkManagerCurrentId = ''
    ext.model.bookmarkManagerHasManualSelection = false
    if (preservedSelection) {
      restoreBookmarkSelectionState(preservedSelection, bookmarks)
    }
    ext.model.bookmarkManagerSuggestedTagsReady = false
    resetTagSuggestionRetry()
    ext.model.bookmarkManagerFolderId ||= 'all'
    if (!preservedSelection) {
      applyBookmarkDeepLinkState()
    }

    renderBookmarkManager(ext.model.bookmarkManager, canModifyBookmarks(), canUpdateBookmarks())
    clearManagerSuggestedTags()
    await updateBookmarkBrowser()
    scrollManagedBookmarkIntoView(ext.model.bookmarkManagerCurrentId)
    scrollActiveFolderIntoView()
    if (!preservedSelection) {
      showManagerStatus('Loaded')
    }
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

async function openBookmarkInManager(bookmarkId) {
  const bookmark = findBookmarkById(ext.model.bookmarkManager?.bookmarks || [], bookmarkId)
  if (!bookmark) {
    return
  }

  ext.model.bookmarkManagerSelectedIds = new Set()
  ext.model.bookmarkManagerCurrentId = String(bookmark.originalId)
  ext.model.bookmarkManagerHasManualSelection = false
  ext.model.bookmarkManagerFolderId = getMostPreciseBookmarkFolderId(ext.model.bookmarkManager, bookmark)
  ext.dom.manager.bookmarkSearch.value = ''
  writeBookmarkDeepLink(bookmark)

  renderActiveManagerScreen()
  await updateBookmarkBrowser()
  scrollManagedBookmarkIntoView(bookmark.originalId)
  scrollActiveFolderIntoView()
}

function applyBookmarkDeepLinkState() {
  if (window.location.hash !== '#bookmarks') {
    return
  }

  const params = new URLSearchParams(window.location.search)
  const bookmarkId = params.get('bookmark')
  const folderId = params.get('folder')
  const searchTerm = params.get('search')
  const folder = folderId ? findFolderById(ext.model.bookmarkManager?.folderTree, folderId) : null

  const hasAllFolder = folderId === 'all'

  if (hasAllFolder) {
    ext.model.bookmarkManagerFolderId = 'all'
  } else if (folder) {
    ext.model.bookmarkManagerFolderId = folderId
  }

  if (searchTerm) {
    ext.dom.manager.bookmarkSearch.value = searchTerm
  }

  if (!bookmarkId) {
    return
  }

  const bookmark = findBookmarkById(ext.model.bookmarkManager?.bookmarks || [], bookmarkId)
  if (!bookmark) {
    return
  }

  ext.model.bookmarkManagerSelectedIds = new Set()
  ext.model.bookmarkManagerCurrentId = String(bookmark.originalId)
  ext.model.bookmarkManagerHasManualSelection = false
  ext.model.bookmarkManagerFolderId =
    folder || hasAllFolder ? folderId : getMostPreciseBookmarkFolderId(ext.model.bookmarkManager, bookmark)
  ext.dom.manager.bookmarkSearch.value = searchTerm || ''
}

function writeBookmarkDeepLink(bookmark) {
  const folderId = getMostPreciseBookmarkFolderId(ext.model.bookmarkManager, bookmark)
  const url = new URL(window.location.href)
  url.searchParams.set('folder', folderId)
  url.searchParams.set('bookmark', String(bookmark.originalId))
  url.searchParams.delete('search')
  url.hash = 'bookmarks'
  window.history.pushState(null, '', `${url.pathname}${url.search}${url.hash}`)
}

function writeBookmarkBrowserUrl() {
  const url = new URL(window.location.href)
  const folderId = ext.model.bookmarkManagerFolderId || 'all'
  const searchTerm = ext.dom.manager.bookmarkSearch.value.trim()
  const bookmarkId = getCurrentManagedBookmarkId()

  url.searchParams.set('folder', folderId)

  if (searchTerm) {
    url.searchParams.set('search', searchTerm)
  } else {
    url.searchParams.delete('search')
  }

  if (bookmarkId) {
    url.searchParams.set('bookmark', bookmarkId)
  } else {
    url.searchParams.delete('bookmark')
  }

  url.hash = 'bookmarks'
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
}

function scrollManagedBookmarkIntoView(bookmarkId) {
  if (!bookmarkId) {
    return
  }

  const row = document.querySelector(`[data-managed-bookmark-row-id="${CSS.escape(String(bookmarkId))}"]`)
  if (!row) {
    return
  }

  row.scrollIntoView({ block: 'center' })
}

function scrollActiveFolderIntoView() {
  const folderId = ext.model.bookmarkManagerFolderId || 'all'
  const folderButton = document.querySelector(`[data-manager-folder-id="${CSS.escape(String(folderId))}"]`)
  if (!folderButton) {
    return
  }

  folderButton.scrollIntoView({ block: 'center' })
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

  return filterBookmarksByFolder(results, ext.model.bookmarkManager?.folderTree, folderId)
}

async function saveManagedBookmark() {
  const bookmarkId = getCurrentManagedBookmarkId()
  if (!bookmarkId || !canUpdateBookmarks()) {
    return
  }

  const bookmark = findBookmarkById(ext.model.bookmarkManager?.bookmarks || [], bookmarkId)
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
  const selectedIds = getManagedActionTargetIds()
  const parentId = ext.dom.manager.bookmarkMoveFolder.value
  if (!selectedIds.length || !parentId || !canMoveBookmarks()) {
    return
  }

  const confirmed = window.confirm(`Move ${selectedIds.length} bookmark(s)?`)
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
  const selectedIds = getManagedActionTargetIds()
  await bulkTagBookmarks(selectedIds, mode)
}

async function suggestTagsForSelectedBookmarks() {
  const selectedIds = getManagedActionTargetIds()
  if (!selectedIds.length) {
    return
  }

  const bookmarks = getBookmarksByIds(selectedIds)
  await suggestTagsForBookmarks(bookmarks, 'bulk')
}

async function suggestTagsForBookmarks(bookmarks, target) {
  if (!bookmarks.length) {
    return
  }

  const suggestionKey = createTagSuggestionKey(bookmarks)
  const liberal = getTagSuggestionRetryCount(suggestionKey) > 0

  if (target === 'bulk') {
    clearManagerSuggestedTags()
  }

  try {
    showTagSuggestionBusy(true, 'Checking local AI...')
    showTagSuggestionStatus(liberal ? 'Trying broader suggestions...' : 'Checking local AI...')
    showManagerStatus('Checking local AI...')
    const availability = await getLocalAiTagAvailability()
    showLocalAiTagAvailability(availability)

    if (availability === 'unsupported' || availability === 'unavailable') {
      showManagerStatus('Local AI unavailable', 'error')
      showTagSuggestionStatus('Local AI unavailable', 'error')
      return
    }

    showManagerStatus(availability === 'available' ? 'Suggesting tags...' : 'Downloading local AI model...')
    showTagSuggestionBusy(true, availability === 'available' ? 'Suggesting tags...' : 'Downloading local AI model...')
    showTagSuggestionStatus(liberal ? 'Trying broader suggestions...' : 'Suggesting tags...')
    const aiTags = await suggestBookmarkTags(
      bookmarks,
      getKnownBookmarkTags(),
      (progress) => {
        const message = `Downloading local AI model ${Math.round(progress * 100)}%`
        showManagerStatus(message)
        showTagSuggestionBusy(true, message)
        showTagSuggestionStatus(message)
      },
      { liberal },
    )

    const commonTags = bookmarks.length > 1 ? getCommonTags(bookmarks) : []
    const tags = uniqueTags(commonTags.concat(aiTags))

    if (!tags.length) {
      bumpTagSuggestionRetry(suggestionKey)
      showTagSuggestionStatus(
        liberal ? 'No broader tags suggested' : 'No tags suggested. Click Suggest tags again to try broader matches.',
        'error',
      )
      return
    }

    addManagerTagInputValues(target, tags)
    resetTagSuggestionRetry()
    showTagSuggestionStatus(`Suggested ${tags.length} tag(s)`, 'success')
    showManagerStatus(`Suggested ${tags.length} tag(s)`, 'success')
    const nextAvailability = await getLocalAiTagAvailability()
    showLocalAiTagAvailability(nextAvailability)
  } catch (error) {
    showManagerStatus('Tag suggestion failed', 'error')
    showTagSuggestionStatus('Tag suggestion failed', 'error')
    printError(error, 'Could not suggest bookmark tags with local AI.')
  } finally {
    showTagSuggestionBusy(false)
  }
}

function createTagSuggestionKey(bookmarks) {
  return bookmarks.map((bookmark) => String(bookmark.originalId || bookmark.id || '')).join('|')
}

function getTagSuggestionRetryCount(key) {
  if (ext.model.bookmarkManagerTagSuggestionRetryKey !== key) {
    ext.model.bookmarkManagerTagSuggestionRetryKey = key
    ext.model.bookmarkManagerTagSuggestionRetryCount = 0
  }

  return ext.model.bookmarkManagerTagSuggestionRetryCount || 0
}

function bumpTagSuggestionRetry(key) {
  if (ext.model.bookmarkManagerTagSuggestionRetryKey !== key) {
    ext.model.bookmarkManagerTagSuggestionRetryKey = key
    ext.model.bookmarkManagerTagSuggestionRetryCount = 0
  }

  ext.model.bookmarkManagerTagSuggestionRetryCount = (ext.model.bookmarkManagerTagSuggestionRetryCount || 0) + 1
}

function resetTagSuggestionRetry() {
  ext.model.bookmarkManagerTagSuggestionRetryKey = ''
  ext.model.bookmarkManagerTagSuggestionRetryCount = 0
}

function getBookmarkSelectionState() {
  return {
    selectedIds: [...(ext.model.bookmarkManagerSelectedIds || new Set())],
    currentId: ext.model.bookmarkManagerCurrentId || '',
    hasManualSelection: Boolean(ext.model.bookmarkManagerHasManualSelection),
    folderId: ext.model.bookmarkManagerFolderId || 'all',
    searchTerm: ext.dom.manager?.bookmarkSearch?.value || '',
  }
}

function restoreBookmarkSelectionState(selection, bookmarks) {
  const existingIds = new Set(bookmarks.map((bookmark) => String(bookmark.originalId)))
  const selectedIds = new Set()

  for (let i = 0; i < selection.selectedIds.length; i++) {
    const bookmarkId = String(selection.selectedIds[i])
    if (existingIds.has(bookmarkId)) {
      selectedIds.add(bookmarkId)
    }
  }

  const currentId = String(selection.currentId || '')
  ext.model.bookmarkManagerSelectedIds = selectedIds
  ext.model.bookmarkManagerCurrentId = existingIds.has(currentId) ? currentId : ''
  ext.model.bookmarkManagerHasManualSelection = Boolean(selection.hasManualSelection && selectedIds.size)
  ext.model.bookmarkManagerFolderId = selection.folderId || 'all'

  if (ext.dom.manager?.bookmarkSearch) {
    ext.dom.manager.bookmarkSearch.value = selection.searchTerm || ''
  }
}

async function bulkTagBookmarks(bookmarkIds, mode) {
  if (!bookmarkIds.length || !canUpdateBookmarks()) {
    return
  }

  const tags = getManagerTagInputValues('bulk')
  if (!tags.length) {
    showManagerStatus('Add at least one tag.', 'error')
    return
  }

  try {
    showManagerStatus('Updating tags...')
    const bookmarkIdSet = new Set(bookmarkIds.map(String))
    const bookmarks = (ext.model.bookmarkManager?.bookmarks || []).filter((bookmark) =>
      bookmarkIdSet.has(String(bookmark.originalId)),
    )
    await updateTaggedBookmarks(bookmarks, (currentTags) => mergeBulkTags(currentTags, tags, mode))
    clearBulkTagInput()
    await reloadBookmarkManager({ preserveBookmarkSelection: true })
    showManagerStatus(`Updated ${bookmarkIds.length} bookmark(s)`, 'success')
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

function getBookmarksByIds(bookmarkIds) {
  const bookmarkIdSet = new Set(bookmarkIds.map(String))
  const bookmarks = ext.model.bookmarkManager?.bookmarks || []
  return bookmarks.filter((bookmark) => bookmarkIdSet.has(String(bookmark.originalId)))
}

function getKnownBookmarkTags() {
  const tagGroups = ext.model.bookmarkManager?.tagGroups || []
  const tags = new Array(tagGroups.length)
  for (let i = 0; i < tagGroups.length; i++) {
    tags[i] = {
      name: tagGroups[i].name,
      count: tagGroups[i].count,
    }
  }
  return tags
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

function clearBulkTagInput() {
  clearManagerSuggestedTags()
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
