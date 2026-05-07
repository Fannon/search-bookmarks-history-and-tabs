/**
 * @file Coordinates the dedicated bookmark manager page.
 */

import { createSearchStringLower } from './helper/browserApi.js'
import { createExtensionContext } from './helper/extensionContext.js'
import { getLocalAiTagAvailability, suggestBookmarkTags } from './helper/localAiTags.js'
import { cleanUpUrl } from './helper/utils.js'
import {
  bookmarkCleanupProposalSchema,
  countBookmarkCleanupChanges,
  createBookmarkCleanupPrompt,
  parseBookmarkCleanupProposalWithIssues,
} from './model/bookmarkCleanupProposal.js'
import { createBookmarkExportFilename, createBookmarkExportHtml } from './model/bookmarkExport.js'
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
import {
  createBookmarkUndoSnapshot,
  getBookmarkUndoSnapshots,
  removeBookmarkUndoSnapshot,
  saveBookmarkUndoSnapshot,
} from './model/bookmarkManagerUndo.js'
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
  renderBookmarkCleanupPrompt,
  renderBookmarkCleanupProposal,
  renderBookmarkCleanupScopeOptions,
  renderBookmarkManager,
  renderBookmarkUndoHistory,
  renderBookmarkWorkspace,
  setManagedBookmarkSelected,
  showCleanupIssues,
  showCleanupStatus,
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
    onUndoBookmarkChange: undoBookmarkChange,
    onExportBookmarks: exportBookmarks,
    onExportUndoHistory: exportUndoHistory,
    onImportUndoHistory: importUndoHistory,
    onGenerateCleanupPrompt: generateCleanupPrompt,
    onCleanupScopeChange: resetCleanupPrompt,
    onRunLocalCleanup: runLocalCleanup,
    onCopyCleanupPrompt: copyCleanupPrompt,
    onCleanupProposalInput: parseCleanupProposalInput,
    onApplyCleanupChange: applyCleanupChange,
    onApplyCleanupCategory: applyCleanupCategory,
    onApplyAllCleanupChanges: applyAllCleanupChanges,
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
    const { bookmarks, bookmarkTree } = await getSearchData()
    ext.model.bookmarks = bookmarks
    ext.model.bookmarkTree = bookmarkTree
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
    renderBookmarkCleanupScopeOptions(
      ext.model.bookmarkManager.folderTree,
      ext.model.bookmarkCleanupFolderId || ext.dom.manager.cleanupFolderScope.value || 'all',
    )
    renderCleanupProposal()
    updateBookmarkUndoHistory()
    clearManagerSuggestedTags()
    await updateBookmarkBrowser()
    scrollManagedBookmarkIntoView(ext.model.bookmarkManagerCurrentId)
    scrollActiveFolderIntoView()
    if (!preservedSelection) {
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
    const snapshotCreated = await createUndoSnapshot(`Edited bookmark "${bookmark.title || values.title}"`, [bookmark])
    if (!snapshotCreated) {
      return
    }
    await ext.browserApi.bookmarks.update(bookmarkId, {
      title: createTaggedBookmarkTitle(values.title, values.tags, values.customBonusScore),
      url: values.url,
    })
    updateBookmarkInMemory(bookmark, values.title, values.url, values.tags, values.customBonusScore)
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
    const bookmarks = getBookmarksByIds(selectedIds)
    const snapshotCreated = await createUndoSnapshot(createMoveDescription(bookmarks, parentId), bookmarks)
    if (!snapshotCreated) {
      return
    }
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
    const bookmarkIdSet = new Set(bookmarkIds.map(String))
    const bookmarks = (ext.model.bookmarkManager?.bookmarks || []).filter((bookmark) =>
      bookmarkIdSet.has(String(bookmark.originalId)),
    )
    const snapshotCreated = await createUndoSnapshot(createBulkTagDescription(mode, tags, bookmarks.length), bookmarks)
    if (!snapshotCreated) {
      return
    }
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
    const bookmarks = getBookmarksByIds(selectedIds)
    const snapshotCreated = await createUndoSnapshot(createDeletedDescription(bookmarks.length), bookmarks)
    if (!snapshotCreated) {
      return
    }
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
    const bookmarks = getBookmarksByIds([bookmarkId])
    const snapshotCreated = await createUndoSnapshot(createDeletedDescription(1), bookmarks)
    if (!snapshotCreated) {
      return
    }
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
    const snapshotCreated = await createUndoSnapshot(
      `Renamed tag "${oldTag}" to "${newTag}" on ${formatBookmarkCount(bookmarks.length)}`,
      bookmarks,
    )
    if (!snapshotCreated) {
      return
    }
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
    const snapshotCreated = await createUndoSnapshot(
      `Removed tag "${tagName}" from ${formatBookmarkCount(bookmarks.length)}`,
      bookmarks,
    )
    if (!snapshotCreated) {
      return
    }
    await updateTaggedBookmarks(bookmarks, (tags) => tags.filter((tag) => tag !== tagName))
    showManagerStatus(`Removed #${tagName}`, 'success')
    await reloadBookmarkManager()
  } catch (error) {
    showManagerStatus('Remove failed', 'error')
    printError(error, 'Could not remove bookmark tag.')
  }
}

function generateCleanupPrompt() {
  const prompt = createBookmarkCleanupPrompt(getScopedCleanupModel())
  ext.model.bookmarkCleanupPrompt = prompt
  renderBookmarkCleanupPrompt(prompt, Boolean(ext.model.bookmarkManagerLocalAiAvailable))
  showCleanupStatus('Prompt generated', 'success')
}

async function runLocalCleanup() {
  const prompt = ext.model.bookmarkCleanupPrompt || createBookmarkCleanupPrompt(getScopedCleanupModel())
  const languageModel = globalThis.LanguageModel

  if (!languageModel?.create) {
    showCleanupStatus('Local AI is unavailable in this browser.', 'error')
    return
  }

  let session
  try {
    renderBookmarkCleanupPrompt(prompt, false)
    showCleanupStatus('Running local AI...')
    showManagerStatus('Running cleanup proposal...')
    session = await languageModel.create({
      expectedInputs: [{ type: 'text', languages: ['en'] }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }],
    })
    const response = await session.prompt(prompt, {
      responseConstraint: bookmarkCleanupProposalSchema,
    })
    setCleanupProposalJson(response)
    parseCleanupProposalText()
  } catch (error) {
    showCleanupStatus('Local cleanup proposal failed', 'error')
    showManagerStatus('Cleanup proposal failed', 'error')
    printError(error, 'Could not create bookmark cleanup proposal with local AI.')
  } finally {
    if (typeof session?.destroy === 'function') {
      session.destroy()
    }
    renderBookmarkCleanupPrompt(prompt, Boolean(ext.model.bookmarkManagerLocalAiAvailable))
  }
}

function resetCleanupPrompt() {
  ext.model.bookmarkCleanupFolderId = ext.dom.manager.cleanupFolderScope.value || 'all'
  ext.model.bookmarkCleanupPrompt = ''
  renderBookmarkCleanupPrompt('', Boolean(ext.model.bookmarkManagerLocalAiAvailable))
  showCleanupStatus('')
}

async function copyCleanupPrompt() {
  const prompt = ext.dom.manager.cleanupPrompt.value
  if (!prompt) {
    return
  }

  try {
    await navigator.clipboard.writeText(prompt)
    showCleanupStatus('Prompt copied', 'success')
  } catch (error) {
    showCleanupStatus('Could not copy prompt', 'error')
    printError(error, 'Could not copy cleanup prompt.')
  }
}

function parseCleanupProposalInput() {
  if (ext.model.bookmarkCleanupFormattingProposal) {
    return
  }
  if (!ext.dom.manager.cleanupProposalJson.value.trim()) {
    window.clearTimeout(ext.model.bookmarkCleanupParseTimer)
    ext.model.bookmarkCleanupProposal = null
    ext.model.bookmarkCleanupAppliedChangeIds = new Set()
    renderCleanupProposal()
    showCleanupIssues([], [])
    return
  }
  window.clearTimeout(ext.model.bookmarkCleanupParseTimer)
  ext.model.bookmarkCleanupParseTimer = window.setTimeout(parseCleanupProposalText, 180)
}

function parseCleanupProposalText() {
  window.clearTimeout(ext.model.bookmarkCleanupParseTimer)
  const result = parseBookmarkCleanupProposalWithIssues(
    ext.dom.manager.cleanupProposalJson.value,
    ext.model.bookmarkManager,
  )

  if (result.proposal) {
    setCleanupProposalJson(JSON.stringify(result.proposal, null, 2))
    ext.model.bookmarkCleanupProposal = result.proposal
    ext.model.bookmarkCleanupAppliedChangeIds = new Set()
    renderCleanupProposal()
    const message = `Loaded ${countBookmarkCleanupChanges(result.proposal)} proposed change(s)`
    if (result.errors.length || result.warnings.length) {
      showCleanupIssues(result.errors, result.warnings, message)
    } else {
      showCleanupIssues([], [])
      showCleanupStatus(message, 'success')
    }
    return
  }
  ext.model.bookmarkCleanupProposal = null
  ext.model.bookmarkCleanupAppliedChangeIds = new Set()
  renderCleanupProposal()
  showCleanupIssues(result.errors, result.warnings, 'Proposal JSON is invalid')
}

function setCleanupProposalJson(value) {
  ext.model.bookmarkCleanupFormattingProposal = true
  ext.dom.manager.cleanupProposalJson.value = value
  ext.model.bookmarkCleanupFormattingProposal = false
}

async function applyCleanupChange(type, index) {
  const proposal = ext.model.bookmarkCleanupProposal
  const change = proposal?.changes?.[type]?.[index]
  if (!change || ext.model.bookmarkCleanupAppliedChangeIds?.has(change.id)) {
    return
  }

  try {
    const applied = await applyCleanupChanges([{ type, change }], `AI cleanup: ${describeCleanupChange(type, change)}`)
    if (!applied) {
      return
    }
    markCleanupChangeApplied(change.id)
    renderCleanupProposal()
    showManagerStatus('Applied cleanup change', 'success')
    await reloadBookmarkManager({ preserveBookmarkSelection: true })
  } catch (error) {
    showManagerStatus('Cleanup change failed', 'error')
    printError(error, 'Could not apply cleanup change.')
  }
}

async function applyCleanupCategory(type) {
  const proposal = ext.model.bookmarkCleanupProposal
  const appliedIds = ext.model.bookmarkCleanupAppliedChangeIds || new Set()
  const changes = (proposal?.changes?.[type] || [])
    .filter((change) => !appliedIds.has(change.id))
    .map((change) => ({ type, change }))

  if (!changes.length) {
    return
  }

  try {
    const applied = await applyCleanupChanges(changes, `AI cleanup: ${describeCleanupChanges(changes)}`)
    if (!applied) {
      return
    }
    for (let i = 0; i < changes.length; i++) {
      markCleanupChangeApplied(changes[i].change.id)
    }
    renderCleanupProposal()
    showManagerStatus(`Applied ${changes.length} cleanup change(s)`, 'success')
    await reloadBookmarkManager({ preserveBookmarkSelection: true })
  } catch (error) {
    showManagerStatus('Cleanup category failed', 'error')
    printError(error, 'Could not apply cleanup category.')
  }
}

async function applyAllCleanupChanges() {
  const proposal = ext.model.bookmarkCleanupProposal
  const changes = getPendingCleanupChanges(proposal)
  if (!changes.length) {
    return
  }

  try {
    const applied = await applyCleanupChanges(changes, `AI cleanup: ${describeCleanupChanges(changes)}`)
    if (!applied) {
      return
    }
    for (let i = 0; i < changes.length; i++) {
      markCleanupChangeApplied(changes[i].change.id)
    }
    renderCleanupProposal()
    showManagerStatus(`Applied ${changes.length} cleanup change(s)`, 'success')
    await reloadBookmarkManager({ preserveBookmarkSelection: true })
  } catch (error) {
    showManagerStatus('Cleanup changes failed', 'error')
    printError(error, 'Could not apply cleanup changes.')
  }
}

async function applyCleanupChanges(changes, description) {
  const affectedBookmarks = getCleanupAffectedBookmarks(changes)
  const snapshotCreated = await createUndoSnapshot(description, affectedBookmarks)
  if (!snapshotCreated) {
    return false
  }

  for (let i = 0; i < changes.length; i++) {
    const { type, change } = changes[i]
    if (type === 'addTags') {
      await applyCleanupAddTags(change)
    } else if (type === 'removeTags') {
      await applyCleanupRemoveTags(change)
    } else if (type === 'renameTags') {
      await applyCleanupRenameTag(change)
    } else if (type === 'moveBookmarks') {
      await applyCleanupMoveBookmark(change)
    } else if (type === 'deleteBookmarks') {
      await applyCleanupDeleteBookmark(change)
    }
  }

  return true
}

async function applyCleanupAddTags(change) {
  if (!canUpdateBookmarks()) {
    throw new Error('Bookmark updates are unavailable.')
  }
  const bookmark = findBookmarkById(ext.model.bookmarkManager?.bookmarks || [], change.bookmarkId)
  if (!bookmark) {
    return
  }
  await updateTaggedBookmarks([bookmark], (tags) => mergeBulkTags(tags, change.tags, 'add'))
}

async function applyCleanupRemoveTags(change) {
  if (!canUpdateBookmarks()) {
    throw new Error('Bookmark updates are unavailable.')
  }
  const bookmark = findBookmarkById(ext.model.bookmarkManager?.bookmarks || [], change.bookmarkId)
  if (!bookmark) {
    return
  }
  await updateTaggedBookmarks([bookmark], (tags) => mergeBulkTags(tags, change.tags, 'remove'))
}

async function applyCleanupRenameTag(change) {
  if (!canUpdateBookmarks()) {
    throw new Error('Bookmark updates are unavailable.')
  }
  const bookmarks = getCleanupRenameTagBookmarks(change)
  await updateTaggedBookmarks(bookmarks, (tags) =>
    uniqueTags(tags.map((tag) => (tag.toLowerCase() === change.from.toLowerCase() ? change.to : tag))),
  )
}

async function applyCleanupMoveBookmark(change) {
  if (!canMoveBookmarks()) {
    throw new Error('Bookmark moves are unavailable.')
  }
  await ext.browserApi.bookmarks.move(change.bookmarkId, { parentId: change.targetFolderId })
}

async function applyCleanupDeleteBookmark(change) {
  if (!canModifyBookmarks()) {
    throw new Error('Bookmark deletion is unavailable.')
  }
  await ext.browserApi.bookmarks.remove(change.bookmarkId)
}

function getPendingCleanupChanges(proposal) {
  const result = []
  const appliedIds = ext.model.bookmarkCleanupAppliedChangeIds || new Set()
  const groups = proposal?.changes || {}
  const types = ['addTags', 'removeTags', 'renameTags', 'moveBookmarks', 'deleteBookmarks']

  for (let i = 0; i < types.length; i++) {
    const type = types[i]
    const changes = groups[type] || []
    for (let j = 0; j < changes.length; j++) {
      if (!appliedIds.has(changes[j].id)) {
        result.push({ type, change: changes[j] })
      }
    }
  }

  return result
}

function getCleanupAffectedBookmarks(changes) {
  const ids = new Set()

  for (let i = 0; i < changes.length; i++) {
    const { type, change } = changes[i]
    if (type === 'renameTags') {
      const bookmarks = getCleanupRenameTagBookmarks(change)
      for (let j = 0; j < bookmarks.length; j++) {
        ids.add(String(bookmarks[j].originalId))
      }
    } else {
      ids.add(String(change.bookmarkId))
    }
  }

  return getBookmarksByIds([...ids])
}

function getCleanupRenameTagBookmarks(change) {
  const bookmarks = ext.model.bookmarkManager?.bookmarks || []
  const targetIds = new Set((change.bookmarkIds || []).map(String))
  const from = change.from.toLowerCase()

  return bookmarks.filter((bookmark) => {
    if (targetIds.size && !targetIds.has(String(bookmark.originalId))) {
      return false
    }
    return (bookmark.tagsArray || []).some((tag) => tag.toLowerCase() === from)
  })
}

function markCleanupChangeApplied(changeId) {
  ext.model.bookmarkCleanupAppliedChangeIds ||= new Set()
  ext.model.bookmarkCleanupAppliedChangeIds.add(changeId)
}

function renderCleanupProposal() {
  renderBookmarkCleanupProposal(
    ext.model.bookmarkCleanupProposal,
    ext.model.bookmarkManager,
    ext.model.bookmarkCleanupAppliedChangeIds || new Set(),
  )
}

function getScopedCleanupModel() {
  const managerModel = ext.model.bookmarkManager
  const folderId = ext.dom.manager.cleanupFolderScope.value || 'all'
  const bookmarks = filterBookmarksByFolder(managerModel?.bookmarks || [], managerModel?.folderTree, folderId)
  const bookmarkIds = new Set(bookmarks.map((bookmark) => String(bookmark.originalId)))
  const tagCounts = new Map()

  for (let i = 0; i < bookmarks.length; i++) {
    const tags = bookmarks[i].tagsArray || []
    for (let j = 0; j < tags.length; j++) {
      const tag = tags[j]
      const key = tag.toLowerCase()
      const existing = tagCounts.get(key)
      if (existing) {
        existing.count += 1
      } else {
        tagCounts.set(key, { name: tag, count: 1 })
      }
    }
  }

  return {
    ...managerModel,
    bookmarks,
    duplicateGroups: (managerModel?.duplicateGroups || [])
      .map((group) => ({
        ...group,
        bookmarks: group.bookmarks.filter((bookmark) => bookmarkIds.has(String(bookmark.originalId))),
      }))
      .filter((group) => group.bookmarks.length > 1),
    tagGroups: [...tagCounts.values()].sort((a, b) => {
      if (a.count !== b.count) {
        return b.count - a.count
      }
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    }),
  }
}

function getCleanupBookmarkLabel(bookmarkId) {
  const bookmark = findBookmarkById(ext.model.bookmarkManager?.bookmarks || [], bookmarkId)
  const title = bookmark?.title?.trim() || bookmark?.url || `bookmark ${bookmarkId}`
  return `"${title}"`
}

function describeCleanupChange(type, change) {
  const label = getCleanupBookmarkLabel(change.bookmarkId)
  if (type === 'addTags') {
    const tags = (change.tags || []).map((tag) => `"#${tag}"`).join(', ')
    return `added tags ${tags} to ${label}`
  }
  if (type === 'removeTags') {
    const tags = (change.tags || []).map((tag) => `"#${tag}"`).join(', ')
    return `removed tags ${tags} from ${label}`
  }
  if (type === 'renameTags') {
    return `renamed tag "${change.from}" to "${change.to}"`
  }
  if (type === 'moveBookmarks') {
    return `moved ${label}`
  }
  return `deleted ${label}`
}

function describeCleanupChanges(changes) {
  if (!changes.length) return '0 changes'
  const first = describeCleanupChange(changes[0].type, changes[0].change)
  if (changes.length === 1) return first
  return `${first} and ${changes.length - 1} more`
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

function canRestoreBookmarkSnapshots() {
  return (
    typeof ext.browserApi.bookmarks?.create === 'function' &&
    typeof ext.browserApi.bookmarks?.get === 'function' &&
    typeof ext.browserApi.bookmarks?.move === 'function' &&
    typeof ext.browserApi.bookmarks?.update === 'function'
  )
}

async function checkLocalAiTagSupport() {
  const availability = await getLocalAiTagAvailability()
  showLocalAiTagAvailability(availability)
  renderBookmarkCleanupPrompt(ext.model.bookmarkCleanupPrompt || '', Boolean(ext.model.bookmarkManagerLocalAiAvailable))
  await updateBookmarkBrowser()
}

function getBookmarksByIds(bookmarkIds) {
  const bookmarkIdSet = new Set(bookmarkIds.map(String))
  const bookmarks = ext.model.bookmarkManager?.bookmarks || []
  return bookmarks.filter((bookmark) => bookmarkIdSet.has(String(bookmark.originalId)))
}

async function createUndoSnapshot(description, bookmarks) {
  try {
    const snapshotBookmarks = await getUndoSnapshotBookmarks(bookmarks)
    const snapshot = createBookmarkUndoSnapshot(description, snapshotBookmarks)
    saveBookmarkUndoSnapshot(snapshot)
    updateBookmarkUndoHistory()
    return true
  } catch (error) {
    showManagerStatus('Undo snapshot failed', 'error')
    printError(error, 'Could not create bookmark undo snapshot. No changes were applied.')
    return false
  }
}

async function getUndoSnapshotBookmarks(bookmarks) {
  const snapshotBookmarks = []

  for (let i = 0; i < bookmarks.length; i++) {
    const bookmark = bookmarks[i]
    const browserBookmark = await getBrowserBookmarkNode(bookmark.originalId)
    snapshotBookmarks.push(browserBookmark || createFallbackBookmarkNode(bookmark))
  }

  return snapshotBookmarks
}

async function getBrowserBookmarkNode(bookmarkId) {
  if (!bookmarkId || typeof ext.browserApi.bookmarks?.get !== 'function') {
    return null
  }

  try {
    const bookmarks = await ext.browserApi.bookmarks.get(String(bookmarkId))
    return bookmarks?.[0] || null
  } catch (error) {
    console.warn(`Could not read bookmark "${bookmarkId}" for undo snapshot.`, error)
    return null
  }
}

function createFallbackBookmarkNode(bookmark) {
  return {
    id: String(bookmark.originalId),
    parentId: bookmark.parentId || bookmark.folderId || '',
    index: bookmark.index,
    title: createTaggedBookmarkTitle(bookmark.title, bookmark.tagsArray || [], bookmark.customBonusScore),
    url: bookmark.originalUrl || bookmark.url,
  }
}

async function undoBookmarkChange(snapshotId) {
  const snapshots = getBookmarkUndoSnapshots()
  const restoreSnapshotId = snapshotId || snapshots[0]?.id

  if (!restoreSnapshotId || !canRestoreBookmarkSnapshots()) {
    return
  }

  const snapshot = snapshots.find((entry) => entry.id === restoreSnapshotId)
  if (!snapshot) {
    updateBookmarkUndoHistory()
    return
  }

  const confirmed = window.confirm(`Undo "${snapshot.description}"?`)
  if (!confirmed) {
    return
  }

  try {
    await restoreBookmarkSnapshot(snapshot)
    removeBookmarkUndoSnapshot(snapshot.id)
    updateBookmarkUndoHistory()
    showManagerStatus(`Undid: ${snapshot.description}`, 'success')
    await reloadBookmarkManager()
  } catch (error) {
    showManagerStatus('Undo failed', 'error')
    printError(error, 'Could not restore bookmark undo snapshot.')
  }
}

function exportBookmarks() {
  const bookmarkTree = ext.model.bookmarkTree || []

  try {
    const html = createBookmarkExportHtml(bookmarkTree)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = createBookmarkExportFilename()
    document.body.append(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    showManagerStatus('Exported bookmarks', 'success')
  } catch (error) {
    showManagerStatus('Export failed', 'error')
    printError(error, 'Could not export bookmarks.')
  }
}

function exportUndoHistory() {
  const snapshots = getBookmarkUndoSnapshots()
  if (!snapshots.length) {
    showManagerStatus('No undo history to export', 'error')
    return
  }

  try {
    const payload = createUndoHistoryExport(snapshots)
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = createUndoHistoryExportFilename()
    document.body.append(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    showManagerStatus('Exported undo history', 'success')
  } catch (error) {
    showManagerStatus('Undo export failed', 'error')
    printError(error, 'Could not export bookmark undo history.')
  }
}

async function importUndoHistory(file) {
  if (!file) {
    return
  }

  try {
    const text = await file.text()
    const payload = JSON.parse(text)
    const snapshots = parseUndoHistoryImport(payload)

    if (!snapshots.length) {
      showManagerStatus('No undo snapshots found', 'error')
      return
    }

    for (let i = snapshots.length - 1; i >= 0; i--) {
      saveBookmarkUndoSnapshot(snapshots[i])
    }
    updateBookmarkUndoHistory()
    showManagerStatus(`Imported ${snapshots.length} undo snapshot(s)`, 'success')
  } catch (error) {
    showManagerStatus('Undo import failed', 'error')
    printError(error, 'Could not import bookmark undo history.')
  } finally {
    if (ext.dom.manager?.importUndoHistoryFile) {
      ext.dom.manager.importUndoHistoryFile.value = ''
    }
  }
}

async function restoreBookmarkSnapshot(snapshot) {
  const bookmarks = snapshot.bookmarks.slice().sort(compareSnapshotBookmarks)

  for (let i = 0; i < bookmarks.length; i++) {
    const bookmark = bookmarks[i]
    const existingBookmark = await getBrowserBookmarkNode(bookmark.id)

    if (existingBookmark) {
      await restoreExistingBookmark(bookmark)
    } else {
      await recreateDeletedBookmark(bookmark)
    }
  }
}

async function restoreExistingBookmark(bookmark) {
  await ext.browserApi.bookmarks.update(bookmark.id, {
    title: bookmark.title,
    url: bookmark.url,
  })

  if (bookmark.parentId) {
    const moveInfo = { parentId: bookmark.parentId }
    if (Number.isInteger(bookmark.index)) {
      moveInfo.index = bookmark.index
    }
    await ext.browserApi.bookmarks.move(bookmark.id, moveInfo)
  }
}

async function recreateDeletedBookmark(bookmark) {
  const createInfo = {
    title: bookmark.title,
    url: bookmark.url,
  }

  if (bookmark.parentId) {
    createInfo.parentId = bookmark.parentId
  }
  if (Number.isInteger(bookmark.index)) {
    createInfo.index = bookmark.index
  }

  await ext.browserApi.bookmarks.create(createInfo)
}

function updateBookmarkUndoHistory() {
  renderBookmarkUndoHistory(getBookmarkUndoSnapshots(), canRestoreBookmarkSnapshots())
}

function createUndoHistoryExport(snapshots) {
  return {
    version: 'bookmark-undo-history/v1',
    exportedAt: new Date().toISOString(),
    note: 'Undo snapshots restore previous bookmark state. They are not change proposals because they need prior title, URL, parent folder, and index data.',
    snapshots: snapshots.map((snapshot) => ({
      id: snapshot.id,
      createdAt: new Date(snapshot.createdAt).toISOString(),
      description: snapshot.description,
      bookmarks: snapshot.bookmarks.map((bookmark) => ({
        id: bookmark.id,
        parentId: bookmark.parentId || '',
        index: Number.isInteger(bookmark.index) ? bookmark.index : undefined,
        title: bookmark.title,
        url: bookmark.url,
      })),
    })),
  }
}

function parseUndoHistoryImport(payload) {
  if (!payload || typeof payload !== 'object' || payload.version !== 'bookmark-undo-history/v1') {
    throw new Error('Undo history JSON must use version "bookmark-undo-history/v1".')
  }
  if (!Array.isArray(payload.snapshots)) {
    throw new Error('Undo history JSON must include a snapshots array.')
  }

  const snapshots = []
  for (let i = 0; i < payload.snapshots.length; i++) {
    const snapshot = normalizeImportedUndoSnapshot(payload.snapshots[i], i)
    if (snapshot) {
      snapshots.push(snapshot)
    }
  }
  return snapshots
}

function normalizeImportedUndoSnapshot(snapshot, index) {
  if (!snapshot || typeof snapshot !== 'object' || !Array.isArray(snapshot.bookmarks) || !snapshot.bookmarks.length) {
    return null
  }

  const createdAt = Number.isFinite(Date.parse(snapshot.createdAt)) ? Date.parse(snapshot.createdAt) : Date.now()
  return createBookmarkUndoSnapshot(
    snapshot.description || `Imported undo snapshot ${index + 1}`,
    snapshot.bookmarks,
    createdAt,
  )
}

function createUndoHistoryExportFilename() {
  const now = new Date()
  const date = now.toISOString().slice(0, 10)
  const time = now.toTimeString().slice(0, 8).replaceAll(':', '-')
  return `bookmark-manager-undo-history-${date}-${time}.json`
}

function compareSnapshotBookmarks(a, b) {
  const parentCompare = String(a.parentId || '').localeCompare(String(b.parentId || ''), undefined, {
    numeric: true,
  })
  if (parentCompare !== 0) {
    return parentCompare
  }
  return normalizeSnapshotIndex(a.index) - normalizeSnapshotIndex(b.index)
}

function normalizeSnapshotIndex(index) {
  return Number.isInteger(index) ? index : Number.MAX_SAFE_INTEGER
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
      title: createTaggedBookmarkTitle(bookmark.title, nextTags, bookmark.customBonusScore),
    })
  }
}

function updateBookmarkInMemory(bookmark, title, url, tags, customBonusScore) {
  bookmark.title = title
  bookmark.titleLower = title.toLowerCase().trim()
  bookmark.originalUrl = url
  bookmark.url = cleanUpUrl(url)
  bookmark.customBonusScore = customBonusScore
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

function createDeletedDescription(bookmarkCount) {
  return `Deleted ${formatBookmarkCount(bookmarkCount)}`
}

function createBulkTagDescription(mode, tags, bookmarkCount) {
  const tagText = tags.join(', ')
  if (mode === 'replace') {
    return `Replaced tags with "${tagText}" on ${formatBookmarkCount(bookmarkCount)}`
  }
  if (mode === 'remove') {
    return `Removed tags "${tagText}" from ${formatBookmarkCount(bookmarkCount)}`
  }
  return `Added tags "${tagText}" to ${formatBookmarkCount(bookmarkCount)}`
}

function createMoveDescription(bookmarks, parentId) {
  const sourceFolders = uniqueFolderLabels(bookmarks)
  const sourceFolder = sourceFolders.length === 1 ? sourceFolders[0] : 'multiple folders'
  const targetFolder = getFolderLabelById(parentId)
  return `Moved ${formatBookmarkCount(bookmarks.length)} from ${sourceFolder} to ${targetFolder}`
}

function uniqueFolderLabels(bookmarks) {
  const seen = new Set()
  const result = []

  for (let i = 0; i < bookmarks.length; i++) {
    const label = formatFolderLabel(bookmarks[i].folderArray)
    const key = label.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      result.push(label)
    }
  }

  return result
}

function getFolderLabelById(folderId) {
  const folder = findFolderById(ext.model.bookmarkManager?.folderTree, folderId)
  return folder ? formatFolderLabel(folder.path) : 'Unknown Folder'
}

function formatFolderLabel(folderArray) {
  return folderArray?.length ? folderArray.join('/') : 'Root'
}

function formatBookmarkCount(bookmarkCount) {
  return `${bookmarkCount} bookmark${bookmarkCount === 1 ? '' : 's'}`
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
