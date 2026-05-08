/**
 * @file Renders the dedicated bookmark manager page.
 */

import { escapeHtml } from '../helper/utils.js'
import { canEditCurrentManagedBookmark, findBookmarkById, findFolderById } from '../model/bookmarkManagerOperations.js'
import {
  clearDuplicateBookmarkSelection,
  getSelectedDuplicateBookmarkIds,
  selectSuggestedDuplicateBookmarks,
  selectSuggestedDuplicateGroup,
  updateDuplicateSelectionAction,
} from './bookmarkManagerDuplicateSelection.js'
import { renderDuplicateSummary, renderDuplicates } from './bookmarkManagerDuplicatesView.js'
import {
  createDomainBookmarkHref,
  createFolderBookmarkHref,
  createTagManagerHref,
  renderRecentBookmarks,
  renderStats,
  renderTagSummary,
  renderTopList,
} from './bookmarkManagerOverviewView.js'
import {
  formatInteger,
  renderBookmarkListItem,
  renderBookmarkTitle,
  renderDateBadge,
  renderFolderBadge,
  renderTagBadges,
  renderTrashIcon,
} from './bookmarkManagerRenderHelpers.js'
import {
  ensureManagerTagControls,
  getManagerTagControlValues,
  normalizeManagerTagValues,
  setManagerTagControlDisabled,
  setManagerTagControlValues,
} from './bookmarkManagerTagControls.js'

const MANAGED_BOOKMARK_RENDER_LIMIT = 500
const TAG_BOOKMARK_RENDER_LIMIT = 500

/**
 * Cache bookmark manager DOM references.
 *
 * @returns {Object} DOM references.
 */
export function getBookmarkManagerDom() {
  return {
    status: document.getElementById('manager-status'),
    bookmarkSearch: document.getElementById('bookmark-manager-search'),
    bookmarkFolderTree: document.getElementById('bookmark-folder-tree'),
    bookmarkBrowserSummary: document.getElementById('bookmark-browser-summary'),
    managedBookmarkList: document.getElementById('managed-bookmark-list'),
    selectVisibleBookmarks: document.getElementById('select-visible-bookmarks'),
    clearManagedSelection: document.getElementById('clear-managed-selection'),
    bookmarkSelectionSummary: document.getElementById('bookmark-selection-summary'),
    bookmarkMoveFolder: document.getElementById('bookmark-move-folder'),
    moveSelectedBookmarks: document.getElementById('move-selected-bookmarks'),
    bulkTagsInput: document.getElementById('bookmark-bulk-tags'),
    suggestTagsSelected: document.getElementById('suggest-tags-selected'),
    tagSuggestionStatus: document.getElementById('tag-suggestion-status'),
    addTagsSelected: document.getElementById('add-tags-selected'),
    replaceTagsSelected: document.getElementById('replace-tags-selected'),
    removeTagsSelected: document.getElementById('remove-tags-selected'),
    bookmarkEditTitle: document.getElementById('bookmark-edit-title'),
    bookmarkEditUrl: document.getElementById('bookmark-edit-url'),
    bookmarkEditTags: document.getElementById('bookmark-edit-tags'),
    bookmarkEditScore: document.getElementById('bookmark-edit-score'),
    openBookmarkEditor: document.getElementById('open-bookmark-editor'),
    saveManagedBookmark: document.getElementById('save-managed-bookmark'),
    statsGrid: document.getElementById('stats-grid'),
    topTags: document.getElementById('top-tags'),
    topDomains: document.getElementById('top-domains'),
    topFolders: document.getElementById('top-folders'),
    recentBookmarks: document.getElementById('recent-bookmarks'),
    bookmarkCount: document.getElementById('bookmark-count'),
    duplicateSummary: document.getElementById('duplicate-summary'),
    duplicateCount: document.getElementById('duplicate-count'),
    duplicatesList: document.getElementById('duplicates-list'),
    tagSummary: document.getElementById('tag-summary'),
    tagCount: document.getElementById('tag-count'),
    tagList: document.getElementById('tag-list'),
    tagFilter: document.getElementById('tag-filter'),
    cleanupCount: document.getElementById('cleanup-count'),
    cleanupFolderScope: document.getElementById('cleanup-folder-scope'),
    cleanupChangeLimit: document.getElementById('cleanup-change-limit'),
    cleanupChangeFocus: document.getElementById('cleanup-change-focus'),
    cleanupBookmarkLimit: document.getElementById('cleanup-bookmark-limit'),
    cleanupPrompt: document.getElementById('cleanup-prompt'),
    cleanupPromptSize: document.getElementById('cleanup-prompt-size'),
    cleanupProposalJson: document.getElementById('cleanup-proposal-json'),
    cleanupProposalSummary: document.getElementById('cleanup-proposal-summary'),
    cleanupProposalList: document.getElementById('cleanup-proposal-list'),
    cleanupStatus: document.getElementById('cleanup-status'),
    generateCleanupPrompt: document.getElementById('generate-cleanup-prompt'),
    generateCleanupPromptFull: document.getElementById('generate-cleanup-prompt-full'),
    runLocalCleanup: document.getElementById('run-local-cleanup'),
    copyCleanupPrompt: document.getElementById('copy-cleanup-prompt'),
    applyAllCleanupChanges: document.getElementById('apply-all-cleanup-changes'),
    deleteSelected: document.getElementById('delete-selected'),
    selectSuggested: document.getElementById('select-suggested'),
    selectNone: document.getElementById('select-none'),
    bookmarkUndoHistory: document.getElementById('bookmark-undo-history'),
    undoCount: document.getElementById('undo-count'),
    undoBookmarkChange: document.getElementById('undo-bookmark-change'),
    exportUndoHistory: document.getElementById('export-undo-history'),
    importUndoHistory: document.getElementById('import-undo-history'),
    importUndoHistoryFile: document.getElementById('import-undo-history-file'),
    exportBookmarks: document.getElementById('export-bookmarks'),
    refreshBookmarks: document.getElementById('refresh-bookmarks'),
    loadingIndicator: document.getElementById('manager-load'),
  }
}

/**
 * Render the whole manager from aggregate data.
 *
 * @param {Object} model Bookmark manager model.
 * @param {boolean} canModifyBookmarks Whether destructive bookmark API actions are available.
 * @param {boolean} canUpdateBookmarks Whether bookmark title updates are available.
 */
export function renderBookmarkManager(model, canModifyBookmarks, canUpdateBookmarks) {
  const dom = ext.dom.manager
  const stats = model.stats

  dom.statsGrid.innerHTML = renderStats(stats)
  dom.topTags.innerHTML = renderTopList(stats.topTags, 'No tags found', createTagManagerHref)
  dom.topDomains.innerHTML = renderTopList(stats.topDomains, 'No domains found', createDomainBookmarkHref)
  dom.topFolders.innerHTML = renderTopList(stats.topFolders, 'No folders found', createFolderBookmarkHref)
  renderRecentBookmarksIntoDom()
  dom.bookmarkCount.textContent = stats.bookmarkCount ? String(stats.bookmarkCount) : ''
  dom.duplicateSummary.innerHTML = renderDuplicateSummary(stats)
  dom.duplicateCount.textContent = stats.duplicateGroupCount ? String(stats.duplicateGroupCount) : ''
  dom.tagSummary.innerHTML = renderTagSummary(stats)
  dom.tagCount.textContent = stats.uniqueTagCount ? String(stats.uniqueTagCount) : ''
  dom.duplicatesList.innerHTML = renderDuplicates(model.duplicateGroups, canModifyBookmarks)
  ext.model.bookmarkManagerCanUpdateBookmarks = canUpdateBookmarks
  ext.model.bookmarkManagerCanMoveBookmarks = typeof ext.browserApi.bookmarks?.move === 'function'
  ext.model.bookmarkManagerSelectedIds ||= new Set()
  renderTagManagerIntoDom(canUpdateBookmarks)

  updateDuplicateActions()
}

/**
 * Bind one-time manager events.
 *
 * @param {Object} handlers Event handlers.
 * @param {Function} handlers.onRefresh Refresh handler.
 * @param {Function} handlers.onDeleteSelected Delete handler.
 * @param {Function} handlers.onDeleteOne Single bookmark delete handler.
 * @param {Function} handlers.onBookmarkSearch Search/filter handler.
 * @param {Function} handlers.onSelectBookmark Bookmark selection handler.
 * @param {Function} handlers.onSaveBookmark Single bookmark save handler.
 * @param {Function} handlers.onMoveSelected Move selected bookmarks handler.
 * @param {Function} handlers.onSuggestTagsSelected Suggest tags for selected bookmarks handler.
 * @param {Function} handlers.onBulkTagSelected Bulk tag selected handler.
 * @param {Function} handlers.onRenameTag Tag rename handler.
 * @param {Function} handlers.onRemoveTag Tag removal handler.
 * @param {Function} handlers.onOpenBookmark Open bookmark in the editable bookmark browser.
 * @param {Function} handlers.onOpenBookmarkEditor Open standalone bookmark editor handler.
 * @param {Function} handlers.onBookmarkNavigation Bookmark browser URL state handler.
 * @param {Function} handlers.onUndoBookmarkChange Restore an undo snapshot.
 * @param {Function} handlers.onExportBookmarks Export bookmarks as browser-compatible HTML.
 * @param {Function} handlers.onExportUndoHistory Export undo snapshot history.
 * @param {Function} handlers.onImportUndoHistory Import undo snapshot history.
 * @param {Function} handlers.onGenerateCleanupPrompt Generate cleanup prompt.
 * @param {Function} handlers.onGenerateCleanupPromptFull Generate full cleanup prompt.
 * @param {Function} handlers.onCleanupScopeChange Cleanup prompt scope change.
 * @param {Function} handlers.onRunLocalCleanup Run local AI cleanup proposal.
 * @param {Function} handlers.onCopyCleanupPrompt Copy cleanup prompt.
 * @param {Function} handlers.onCleanupProposalInput Parse proposal JSON after textarea edits.
 * @param {Function} handlers.onApplyCleanupChange Apply one cleanup proposal change.
 * @param {Function} handlers.onApplyCleanupCategory Apply one cleanup proposal category.
 * @param {Function} handlers.onApplyAllCleanupChanges Apply all cleanup proposal changes.
 */
export function bindBookmarkManagerEvents({
  onRefresh,
  onDeleteSelected,
  onDeleteOne,
  onBookmarkSearch,
  onSelectBookmark,
  onSaveBookmark,
  onMoveSelected,
  onSuggestTagsSelected,
  onBulkTagSelected,
  onRenameTag,
  onRemoveTag,
  onOpenBookmark,
  onOpenBookmarkEditor,
  onBookmarkNavigation,
  onUndoBookmarkChange,
  onExportBookmarks,
  onExportUndoHistory,
  onImportUndoHistory,
  onGenerateCleanupPrompt,
  onGenerateCleanupPromptFull,
  onCleanupScopeChange,
  onRunLocalCleanup,
  onCopyCleanupPrompt,
  onCleanupProposalInput,
  onApplyCleanupChange,
  onApplyCleanupCategory,
  onApplyAllCleanupChanges,
}) {
  const dom = ext.dom.manager

  dom.refreshBookmarks.addEventListener('click', onRefresh)
  dom.undoBookmarkChange.addEventListener('click', () => onUndoBookmarkChange())
  dom.exportUndoHistory.addEventListener('click', onExportUndoHistory)
  dom.importUndoHistory.addEventListener('click', () => dom.importUndoHistoryFile.click())
  dom.importUndoHistoryFile.addEventListener('change', () => onImportUndoHistory(dom.importUndoHistoryFile.files?.[0]))
  dom.exportBookmarks.addEventListener('click', onExportBookmarks)
  dom.generateCleanupPrompt.addEventListener('click', onGenerateCleanupPrompt)
  dom.generateCleanupPromptFull.addEventListener('click', onGenerateCleanupPromptFull)
  dom.openBookmarkEditor.addEventListener('click', (event) => {
    if (dom.openBookmarkEditor.getAttribute('aria-disabled') === 'true') {
      event.preventDefault()
      return
    }
    onOpenBookmarkEditor(event, dom.openBookmarkEditor.href)
  })
  dom.cleanupFolderScope.addEventListener('change', onCleanupScopeChange)
  dom.cleanupChangeLimit.addEventListener('change', onCleanupScopeChange)
  dom.cleanupChangeFocus.addEventListener('change', onCleanupScopeChange)
  dom.cleanupBookmarkLimit.addEventListener('change', onCleanupScopeChange)
  dom.runLocalCleanup.addEventListener('click', onRunLocalCleanup)
  dom.copyCleanupPrompt.addEventListener('click', onCopyCleanupPrompt)
  dom.cleanupProposalJson.addEventListener('input', onCleanupProposalInput)
  dom.applyAllCleanupChanges.addEventListener('click', onApplyAllCleanupChanges)
  dom.cleanupProposalList.addEventListener('click', (event) => {
    const categoryButton = event.target.closest('[data-cleanup-category-type]')
    if (categoryButton) {
      onApplyCleanupCategory(categoryButton.dataset.cleanupCategoryType)
      return
    }

    const button = event.target.closest('[data-cleanup-change-type][data-cleanup-change-index]')
    if (!button) {
      return
    }
    onApplyCleanupChange(button.dataset.cleanupChangeType, Number(button.dataset.cleanupChangeIndex))
  })
  dom.bookmarkSearch.addEventListener('input', () => {
    onBookmarkNavigation()
    onBookmarkSearch()
  })
  dom.bookmarkFolderTree.addEventListener('click', (event) => {
    const button = event.target.closest('[data-manager-folder-id]')
    if (!button) {
      return
    }

    ext.model.bookmarkManagerFolderId = button.dataset.managerFolderId
    onBookmarkNavigation()
    onBookmarkSearch()
  })
  dom.managedBookmarkList.addEventListener('change', (event) => {
    if (!event.target.matches('[data-managed-bookmark-id]')) {
      return
    }

    const bookmarkId = event.target.dataset.managedBookmarkId
    const temporarySelectedId = getTemporaryManagedBookmarkSelectedId()
    ext.model.bookmarkManagerHasManualSelection = true

    if (temporarySelectedId && temporarySelectedId !== bookmarkId) {
      onSelectBookmark(temporarySelectedId, true)
    }

    setCurrentManagedBookmark(bookmarkId)
    onSelectBookmark(bookmarkId, event.target.checked || temporarySelectedId === bookmarkId)
    onBookmarkNavigation()
    syncManagedBookmarkSelectionRows()
  })
  dom.managedBookmarkList.addEventListener('click', (event) => {
    const row = event.target.closest('[data-managed-bookmark-row-id]')
    if (!row || event.target.closest('a, button, input')) {
      return
    }

    setCurrentManagedBookmark(row.dataset.managedBookmarkRowId)
    updateManagedSelectionUi()
    onBookmarkNavigation()
  })
  dom.selectVisibleBookmarks.addEventListener('click', () => {
    selectVisibleManagedBookmarks()
    updateManagedSelectionUi()
  })
  dom.clearManagedSelection.addEventListener('click', () => {
    clearManagedBookmarkSelection()
    updateManagedSelectionUi()
  })
  dom.saveManagedBookmark.addEventListener('click', onSaveBookmark)
  dom.bookmarkMoveFolder.addEventListener('change', updateManagedSelectionUi)
  dom.bulkTagsInput.addEventListener('change', updateManagedSelectionUi)
  dom.bulkTagsInput.addEventListener('input', updateManagedSelectionUi)
  dom.moveSelectedBookmarks.addEventListener('click', onMoveSelected)
  dom.suggestTagsSelected.addEventListener('click', onSuggestTagsSelected)
  dom.addTagsSelected.addEventListener('click', () => onBulkTagSelected('add'))
  dom.replaceTagsSelected.addEventListener('click', () => onBulkTagSelected('replace'))
  dom.removeTagsSelected.addEventListener('click', () => onBulkTagSelected('remove'))
  dom.deleteSelected.addEventListener('click', onDeleteSelected)
  dom.selectSuggested.addEventListener('click', selectSuggestedDuplicates)
  dom.selectNone.addEventListener('click', clearDuplicateSelection)
  dom.bookmarkUndoHistory.addEventListener('click', (event) => {
    const button = event.target.closest('[data-undo-snapshot-id]')
    if (button) {
      onUndoBookmarkChange(button.dataset.undoSnapshotId)
    }
  })
  dom.recentBookmarks.addEventListener('click', (event) => {
    const button = event.target.closest('[data-recent-page]')
    if (button) {
      const page = Number(button.dataset.recentPage)
      if (!Number.isFinite(page)) {
        return
      }

      ext.model.bookmarkManagerRecentPage = page
      renderRecentBookmarksIntoDom()
      return
    }

    openBookmarkFromList(event, onOpenBookmark)
  })
  dom.tagFilter.addEventListener('input', () => {
    ext.model.bookmarkManagerTagFilter = dom.tagFilter.value.trim().toLowerCase()
    renderTagManagerIntoDom(ext.model.bookmarkManagerCanUpdateBookmarks)
  })
  dom.tagList.addEventListener('click', (event) => {
    if (openBookmarkFromList(event, onOpenBookmark)) {
      return
    }

    const selectButton = event.target.closest('[data-select-tag]')
    if (selectButton) {
      ext.model.bookmarkManagerSelectedTag = selectButton.dataset.selectTag
      renderTagManagerIntoDom(ext.model.bookmarkManagerCanUpdateBookmarks)
      return
    }

    const renameButton = event.target.closest('[data-rename-tag]')
    if (renameButton) {
      onRenameTag(renameButton.dataset.renameTag)
      return
    }

    const removeButton = event.target.closest('[data-remove-tag]')
    if (removeButton) {
      onRemoveTag(removeButton.dataset.removeTag)
    }
  })
  dom.duplicatesList.addEventListener('change', (event) => {
    if (event.target.matches('[data-delete-bookmark-id]')) {
      updateDuplicateActions()
    }
  })
  dom.duplicatesList.addEventListener('click', (event) => {
    const deleteButton = event.target.closest('[data-delete-single-bookmark-id]')
    if (deleteButton) {
      onDeleteOne(deleteButton.dataset.deleteSingleBookmarkId)
      return
    }

    const button = event.target.closest('[data-select-group]')
    if (!button) {
      return
    }

    const group = button.closest('[data-duplicate-group]')
    if (group) {
      selectSuggestedDuplicateGroup(group)
      updateDuplicateActions()
    }
  })

  window.addEventListener('hashchange', renderActiveManagerScreen)
  renderActiveManagerScreen()
}

function openBookmarkFromList(event, onOpenBookmark) {
  const bookmark = event.target.closest('[data-open-managed-bookmark-id]')
  if (!bookmark) {
    return false
  }

  event.preventDefault()
  onOpenBookmark(bookmark.dataset.openManagedBookmarkId)
  return true
}

let managerStatusDismissId = 0

/**
 * Display a small status message in the manager toolbar.
 * Non-error messages auto-dismiss after 2.5 seconds.
 *
 * @param {string} message Status message.
 * @param {'info'|'error'|'success'} [tone='info'] Message tone.
 */
export function showManagerStatus(message, tone = 'info') {
  const status = getActivePageStatus() || ext.dom.manager?.status
  if (!status) {
    return
  }

  if (managerStatusDismissId) {
    clearTimeout(managerStatusDismissId)
    managerStatusDismissId = 0
  }

  status.textContent = message
  status.dataset.tone = tone

  if (tone !== 'error') {
    managerStatusDismissId = setTimeout(() => {
      status.textContent = ''
      status.dataset.tone = 'info'
      managerStatusDismissId = 0
    }, 2500)
  }
}

function getActivePageStatus() {
  const activePanel = document.querySelector('[data-manager-panel]:not([hidden])')
  return activePanel?.querySelector('[data-page-status]') || null
}

/**
 * Store and surface local AI availability.
 *
 * @param {string} availability Availability state.
 */
export function showLocalAiTagAvailability(availability) {
  ext.model.bookmarkManagerLocalAiAvailability = availability
  ext.model.bookmarkManagerLocalAiAvailable = availability !== 'unsupported' && availability !== 'unavailable'

  const status = ext.dom.manager?.status
  if (!status) {
    return
  }

  if (availability === 'unsupported') {
    status.title = 'Local AI tag suggestions are not supported by this browser.'
  } else if (availability === 'unavailable') {
    status.title = 'Local AI tag suggestions are unavailable on this device.'
  } else if (availability === 'downloadable') {
    status.title = 'Local AI tag suggestions are available after Chrome downloads the local model.'
  } else if (availability === 'downloading') {
    status.title = 'Chrome is downloading the local AI model.'
  } else {
    status.title = 'Local AI tag suggestions are available.'
  }
}

/**
 * Show or clear the inline local-AI suggestion busy state.
 *
 * @param {boolean} busy Whether suggestions are running.
 * @param {string} [message=''] Inline status message.
 */
export function showTagSuggestionBusy(busy, message = '') {
  ext.model.bookmarkManagerSuggestingTags = busy
  const dom = ext.dom.manager
  if (!dom?.suggestTagsSelected) {
    return
  }

  dom.suggestTagsSelected.setAttribute('aria-busy', busy ? 'true' : 'false')
  dom.suggestTagsSelected.title = busy
    ? message || 'Suggesting tags with local AI'
    : 'Suggest tags for checked bookmarks, or the current bookmark if none are checked'
  updateManagedSelectionUi()
}

let tagSuggestionStatusDismissId = 0

/**
 * Display a small status message next to tag suggestion controls.
 * Non-error messages auto-dismiss after 2.5 seconds.
 *
 * @param {string} message Status message.
 * @param {'info'|'error'|'success'} [tone='info'] Message tone.
 */
export function showTagSuggestionStatus(message, tone = 'info') {
  const status = ext.dom.manager?.tagSuggestionStatus
  if (!status) {
    return
  }

  if (tagSuggestionStatusDismissId) {
    clearTimeout(tagSuggestionStatusDismissId)
    tagSuggestionStatusDismissId = 0
  }

  status.textContent = message
  status.dataset.tone = tone

  if (tone !== 'error') {
    tagSuggestionStatusDismissId = setTimeout(() => {
      status.textContent = ''
      status.dataset.tone = 'info'
      tagSuggestionStatusDismissId = 0
    }, 2500)
  }
}

/**
 * Render bookmark undo snapshot history controls.
 *
 * @param {Array<Object>} snapshots In-memory undo snapshots.
 * @param {boolean} canRestore Whether restore actions are available.
 */
export function renderBookmarkUndoHistory(snapshots = [], canRestore = false) {
  const dom = ext.dom.manager
  if (!dom?.bookmarkUndoHistory || !dom?.undoBookmarkChange) {
    return
  }

  if (!snapshots.length) {
    dom.bookmarkUndoHistory.innerHTML = '<p class="empty-state">No bookmark manager changes to undo yet.</p>'
    dom.undoCount.textContent = ''
    dom.undoBookmarkChange.disabled = true
    dom.exportUndoHistory.disabled = true
    dom.undoBookmarkChange.title = 'No bookmark manager changes are available to undo'
    return
  }

  dom.bookmarkUndoHistory.innerHTML = `
    <ol class="bookmark-undo-list">
      ${snapshots.map((snapshot) => renderBookmarkUndoItem(snapshot, canRestore)).join('')}
    </ol>
  `
  dom.undoCount.textContent = String(snapshots.length)
  dom.undoBookmarkChange.disabled = !canRestore
  dom.exportUndoHistory.disabled = false
  dom.undoBookmarkChange.title = canRestore
    ? `Undo latest: ${snapshots[0].description}`
    : 'Bookmark undo is unavailable in this context'
}

/**
 * Return selected duplicate bookmark IDs.
 *
 * @returns {Array<string>} Selected bookmark IDs.
 */
export function getSelectedDuplicateIds() {
  return getSelectedDuplicateBookmarkIds()
}

/**
 * Return selected bookmark IDs from the manager workspace.
 *
 * @returns {Array<string>} Selected bookmark IDs.
 */
export function getSelectedManagedBookmarkIds() {
  return [...(ext.model.bookmarkManagerSelectedIds || new Set())]
}

/**
 * Return the bookmark currently loaded in the single-bookmark editor.
 *
 * @returns {string} Current bookmark id.
 */
export function getCurrentManagedBookmarkId() {
  return ext.model.bookmarkManagerCurrentId || ''
}

/**
 * Return action target IDs: checked bookmarks first, otherwise current bookmark.
 *
 * @returns {Array<string>} Target bookmark IDs.
 */
export function getManagedActionTargetIds() {
  const selectedIds = getSelectedManagedBookmarkIds()
  if (selectedIds.length) {
    return selectedIds
  }

  const currentId = getCurrentManagedBookmarkId()
  return currentId ? [currentId] : []
}

function getVisibleManagedBookmarkIds() {
  const bookmarks = ext.model.bookmarkManagerVisibleBookmarks || []
  const result = new Array(bookmarks.length)
  for (let i = 0; i < bookmarks.length; i++) {
    result[i] = String(bookmarks[i].originalId)
  }
  return result
}

/**
 * Read Tagify or plain input values from one of the manager tag controls.
 *
 * @param {'bulk'|'edit'} source Tag input source.
 * @returns {Array<string>} Normalized tag names.
 */
export function getManagerTagInputValues(_source) {
  return getManagerTagControlValues(ext, _source)
}

/**
 * Read the single-edit form values.
 *
 * @returns {{title: string, url: string, tags: Array<string>, customBonusScore: number}} Form values.
 */
export function getManagedBookmarkEditValues() {
  const dom = ext.dom.manager
  const customBonusScore = Number.parseInt(dom.bookmarkEditScore.value, 10) || 0
  return {
    title: dom.bookmarkEditTitle.value.trim(),
    url: dom.bookmarkEditUrl.value.trim(),
    tags: getManagerTagInputValues('edit'),
    customBonusScore: Math.max(0, customBonusScore),
  }
}

/**
 * Fill one of the manager tag controls with suggested tags.
 *
 * @param {'bulk'|'edit'} target Tag input target.
 * @param {Array<string>} tags Tag names.
 */
export function addManagerTagInputValues(target, tags) {
  const currentTags = getManagerTagInputValues(target)
  const nextTags = normalizeManagerTagValues(currentTags.concat(tags))

  if (target === 'bulk') {
    ext.model.bookmarkManagerSuggestedTagsReady = Boolean(nextTags.length)
    setManagerTagControlDisabled(ext, target, false)
  }

  setManagerTagControlValues(ext, target, nextTags)

  if (target === 'bulk') {
    setManagerTagControlDisabled(ext, target, !nextTags.length)
    updateManagedSelectionUi()
  }
}

/**
 * Clear and disable suggested tag controls.
 */
export function clearManagerSuggestedTags() {
  ext.model.bookmarkManagerSuggestedTagsReady = false
  setManagerTagControlValues(ext, 'bulk', [])
  setManagerTagControlDisabled(ext, 'bulk', true)
  showTagSuggestionStatus('')
  updateManagedSelectionUi()
}

/**
 * Render the bookmark workspace list, folder tree, and selection-aware form.
 *
 * @param {Array<Object>} visibleBookmarks Bookmarks to show in the list.
 * @param {boolean} canUpdateBookmarks Whether updates are available.
 * @param {boolean} canMoveBookmarks Whether moving is available.
 */
export function renderBookmarkWorkspace(visibleBookmarks, canUpdateBookmarks, canMoveBookmarks) {
  const dom = ext.dom.manager
  const model = ext.model.bookmarkManager
  ext.model.bookmarkManagerVisibleBookmarks = visibleBookmarks

  dom.bookmarkFolderTree.innerHTML = renderFolderTree(model.folderTree, ext.model.bookmarkManagerFolderId || 'all')
  dom.bookmarkMoveFolder.innerHTML = renderFolderOptions(model.folderOptions)
  dom.bookmarkMoveFolder.disabled = !canMoveBookmarks
  dom.managedBookmarkList.innerHTML = renderManagedBookmarkList(
    visibleBookmarks,
    canUpdateBookmarks || canMoveBookmarks,
  )

  ensureManagerTagControls(ext)
  updateManagedSelectionUi()
}

/**
 * Update selection state for one managed bookmark.
 *
 * @param {string} bookmarkId Bookmark id.
 * @param {boolean} selected Whether selected.
 */
export function setManagedBookmarkSelected(bookmarkId, selected) {
  const selectedIds = ext.model.bookmarkManagerSelectedIds || new Set()
  ext.model.bookmarkManagerSelectedIds = selectedIds

  if (selected) {
    selectedIds.add(String(bookmarkId))
  } else {
    selectedIds.delete(String(bookmarkId))
  }

  updateManagedSelectionUi()
}

/**
 * Clear bookmark manager selection.
 */
export function clearManagedBookmarkSelection() {
  ext.model.bookmarkManagerSelectedIds = new Set()
  const inputs = document.querySelectorAll('[data-managed-bookmark-id]')
  for (const input of inputs) {
    input.checked = false
  }
  syncManagedBookmarkSelectionRows()
}

/**
 * Show the current hash-selected screen.
 */
export function renderActiveManagerScreen() {
  const hash = window.location.hash
  const screen =
    hash === '#bookmarks' ||
    hash === '#duplicates' ||
    hash === '#tags' ||
    hash === '#cleanup' ||
    hash === '#undo' ||
    hash === '#overview'
      ? hash.slice(1)
      : 'overview'
  const tabs = document.querySelectorAll('[data-manager-tab]')
  const panels = document.querySelectorAll('[data-manager-panel]')

  for (const tab of tabs) {
    const isActive = tab.dataset.managerTab === screen
    tab.classList.toggle('active', isActive)
    if (isActive) {
      tab.setAttribute('aria-current', 'page')
    } else {
      tab.removeAttribute('aria-current')
    }
  }

  for (const panel of panels) {
    panel.hidden = panel.dataset.managerPanel !== screen
  }

  if (screen === 'tags') {
    applyTagManagerUrlState()
    renderTagManagerIntoDom(Boolean(ext.model.bookmarkManagerCanUpdateBookmarks))
  }
}

/**
 * Render cleanup prompt and control state.
 *
 * @param {string} prompt Prompt text.
 * @param {boolean} localAiAvailable Whether local AI can be used.
 */
export function renderBookmarkCleanupPrompt(prompt, localAiAvailable) {
  const dom = ext.dom.manager
  const promptText = String(prompt || '').trim()
  dom.cleanupPrompt.value = promptText
  dom.cleanupPromptSize.textContent = promptText ? formatPromptSize(promptText) : ''
  dom.copyCleanupPrompt.disabled = !promptText
  dom.runLocalCleanup.disabled = !promptText || !localAiAvailable
}

/**
 * Render first-level cleanup prompt scope options.
 *
 * @param {Object} folderTree Bookmark manager folder tree.
 * @param {string} selectedFolderId Selected folder id.
 */
export function renderBookmarkCleanupScopeOptions(folderTree, selectedFolderId = 'all') {
  const select = ext.dom.manager?.cleanupFolderScope
  if (!select) {
    return
  }

  const folders = getBookmarkCleanupScopeFolders(folderTree)
  select.innerHTML = `
    <option value="all">All bookmarks</option>
    ${folders.map(renderBookmarkCleanupScopeOption).join('')}
  `
  select.value = folders.some((folder) => String(folder.id) === String(selectedFolderId)) ? selectedFolderId : 'all'
}

/**
 * Render parsed cleanup proposal changes.
 *
 * @param {Object|null} proposal Cleanup proposal.
 * @param {Object} managerModel Bookmark manager model.
 * @param {Set<string>} appliedChangeIds Applied proposal change IDs.
 */
export function renderBookmarkCleanupProposal(proposal, managerModel, appliedChangeIds = new Set()) {
  const dom = ext.dom.manager
  const changeCount = countCleanupProposalChanges(proposal)

  dom.cleanupCount.textContent = changeCount ? String(changeCount) : ''
  dom.applyAllCleanupChanges.disabled = !changeCount
  dom.cleanupProposalSummary.textContent = proposal?.summary || (changeCount ? '' : 'No cleanup proposal loaded.')
  dom.cleanupProposalList.innerHTML = proposal
    ? renderCleanupChangeGroups(proposal, managerModel, appliedChangeIds)
    : '<p class="empty-state">Generate or paste a proposal to review changes here.</p>'
}

let cleanupStatusDismissId = 0

/**
 * Display cleanup page status.
 * Non-error messages auto-dismiss after 2.5 seconds unless autoDismiss is false.
 *
 * @param {string} message Status message.
 * @param {'info'|'error'|'success'} [tone='info'] Message tone.
 * @param {boolean} [autoDismiss=true] Whether to clear non-error messages automatically.
 */
export function showCleanupStatus(message, tone = 'info', autoDismiss = true) {
  const status = ext.dom.manager?.cleanupStatus
  if (!status) {
    return
  }

  if (cleanupStatusDismissId) {
    clearTimeout(cleanupStatusDismissId)
    cleanupStatusDismissId = 0
  }

  status.textContent = message
  status.dataset.tone = tone

  if (tone !== 'error' && autoDismiss) {
    cleanupStatusDismissId = setTimeout(() => {
      status.textContent = ''
      status.dataset.tone = 'info'
      cleanupStatusDismissId = 0
    }, 2500)
  }
}

/**
 * Display cleanup proposal parser errors and warnings.
 *
 * @param {Array<string>} errors Hard parse errors.
 * @param {Array<string>} warnings Recoverable proposal warnings.
 * @param {string} [message=''] Optional leading status message.
 */
export function showCleanupIssues(errors = [], warnings = [], message = '') {
  const status = ext.dom.manager?.cleanupStatus
  if (!status) {
    return
  }

  if (!errors.length && !warnings.length && !message) {
    status.innerHTML = ''
    status.dataset.tone = 'info'
    return
  }

  status.innerHTML = `
    ${message ? `<div class="cleanup-status-message">${escapeHtml(message)}</div>` : ''}
    ${errors.length ? renderCleanupIssueList('Errors', errors, 'error') : ''}
    ${warnings.length ? renderCleanupIssueList('Warnings', warnings, 'warning') : ''}
  `
  status.dataset.tone = errors.length ? 'error' : 'warning'
}

function renderCleanupIssueList(title, issues, tone) {
  return `
    <section class="cleanup-issues cleanup-issues-${tone}">
      <h3>${escapeHtml(title)}</h3>
      <ul>
        ${issues.map((issue) => `<li>${escapeHtml(issue)}</li>`).join('')}
      </ul>
    </section>
  `
}

function renderCleanupChangeGroups(proposal, managerModel, appliedChangeIds) {
  const groups = [
    ['addTags', 'Add Tags', proposal.changes.addTags],
    ['removeTags', 'Remove Tags', proposal.changes.removeTags],
    ['renameTags', 'Rename or Merge Tags', proposal.changes.renameTags],
    ['moveBookmarks', 'Move Bookmarks', proposal.changes.moveBookmarks],
    ['rewriteTitles', 'Rewrite Titles', proposal.changes.rewriteTitles],
    ['deleteBookmarks', 'Delete Duplicate Bookmarks', proposal.changes.deleteBookmarks],
  ]

  return groups
    .map(([type, title, changes]) => renderCleanupChangeGroup(type, title, changes, managerModel, appliedChangeIds))
    .join('')
}

function renderBookmarkCleanupScopeOption(folder) {
  const folderId = String(folder.id)
  const label = folder.path?.length ? folder.path.join(' / ') : folder.title
  const count = formatInteger(folder.totalCount || folder.count || 0)
  const indent = '\u00a0\u00a0\u00a0\u00a0'.repeat(Math.max(0, (folder.path?.length || 1) - 1))
  return `<option value="${escapeHtml(folderId)}">${indent}${escapeHtml(label)} (${count})</option>`
}

function getBookmarkCleanupScopeFolders(folderTree) {
  const result = []
  const children = folderTree?.children || []

  for (let i = 0; i < children.length; i++) {
    collectBookmarkCleanupScopeFolders(children[i], result)
  }

  return result
}

function collectBookmarkCleanupScopeFolders(folder, result) {
  if (!folder || (folder.path?.length || 0) > 2) {
    return
  }

  result.push(folder)

  const children = folder.children || []
  for (let i = 0; i < children.length; i++) {
    collectBookmarkCleanupScopeFolders(children[i], result)
  }
}

function renderCleanupChangeGroup(type, title, changes, managerModel, appliedChangeIds) {
  const pendingCount = changes.filter((change) => !appliedChangeIds.has(change.id)).length
  const disabled = pendingCount ? '' : ' disabled'

  if (!changes.length) {
    return `
      <section class="cleanup-change-group">
        <h3>${escapeHtml(title)}</h3>
        <p class="empty-state">No changes proposed.</p>
      </section>
    `
  }

  return `
    <section class="cleanup-change-group">
      <header class="cleanup-change-group-header">
        <h3>${escapeHtml(title)} <span>${formatInteger(changes.length)}</span></h3>
        <button class="button success" type="button" data-cleanup-category-type="${escapeHtml(type)}"${disabled}>
          Accept All${pendingCount === changes.length ? '' : ` (${formatInteger(pendingCount)})`}
        </button>
      </header>
      <ol class="cleanup-change-list">
        ${changes.map((change, index) => renderCleanupChange(type, change, index, managerModel, appliedChangeIds)).join('')}
      </ol>
    </section>
  `
}

function renderCleanupChange(type, change, index, managerModel, appliedChangeIds) {
  const applied = appliedChangeIds.has(change.id)
  const bookmark = findBookmarkById(managerModel?.bookmarks || [], change.bookmarkId)
  const keepBookmark = findBookmarkById(managerModel?.bookmarks || [], change.duplicateOfBookmarkId)
  const disabled = applied ? ' disabled' : ''
  const appliedClass = applied ? ' applied' : ''

  if (type === 'deleteBookmarks') {
    return renderCleanupDuplicateChange(change, index, bookmark, keepBookmark, managerModel, applied)
  }

  return `
    <li class="cleanup-change${appliedClass}">
      <div class="cleanup-bookmark-card">
        ${renderCleanupBookmarkCard(bookmark, change.bookmarkId, managerModel)}
      </div>
      <div class="cleanup-proposal-card">
        <div class="cleanup-change-title">${renderCleanupChangeTitle(type, change, bookmark, managerModel)}</div>
        ${renderCleanupReason(change.reason)}
      </div>
      <button class="button success" type="button" data-cleanup-change-type="${escapeHtml(type)}"
        data-cleanup-change-index="${index}"${disabled}>${applied ? 'Applied' : 'Accept'}</button>
    </li>
  `
}

function renderCleanupReason(reason) {
  const text = String(reason || '').trim()
  return text ? `<p>${escapeHtml(text)}</p>` : ''
}

function renderCleanupChangeTitle(type, change, bookmark, managerModel) {
  if (type === 'addTags') {
    return `Add ${renderCleanupTags(change.tags)}`
  }
  if (type === 'removeTags') {
    return `Remove ${renderCleanupTags(change.tags)}`
  }
  if (type === 'renameTags') {
    return `Rename ${renderCleanupTagLink(change.from)} to ${renderCleanupTagLink(change.to)}`
  }
  if (type === 'moveBookmarks') {
    const folderLabel =
      getFolderLabelById(managerModel, change.targetFolderId) || change.targetFolderPath || change.targetFolderId
    return `Move to ${renderCleanupFolderLink(
      { id: change.targetFolderId, label: folderLabel },
      folderLabel,
      managerModel,
    )}`
  }
  if (type === 'rewriteTitles') {
    return `Rewrite to ${renderCleanupBookmarkLabel({ title: change.title }, change.bookmarkId)}`
  }
  return renderCleanupBookmarkLabel(bookmark, change.bookmarkId)
}

function renderCleanupBookmarkLabel(bookmark, fallbackId) {
  const title = bookmark?.title || `Bookmark ${fallbackId}`
  return `<span class="cleanup-bookmark-title">${escapeHtml(title)}</span>`
}

function renderCleanupBookmarkCard(bookmark, fallbackId, managerModel) {
  if (!bookmark) {
    return `
      <div class="bookmark-title">${renderCleanupBookmarkLabel(null, fallbackId)}</div>
      <p class="empty-state">Bookmark not found.</p>
    `
  }

  const displayUrl = bookmark.originalUrl || bookmark.url || ''
  return `
    <div class="bookmark-title">${renderBookmarkTitle(bookmark)}</div>
    <div class="bookmark-meta">
      ${renderCleanupFolderForBookmark(bookmark, managerModel)}
      ${renderDateBadge(bookmark.dateAdded)}
      ${renderCleanupTags(bookmark.tagsArray || [])}
    </div>
    <div class="bookmark-url" title="${escapeHtml(displayUrl)}">${escapeHtml(displayUrl)}</div>
  `
}

function renderCleanupDuplicateChange(change, index, bookmark, keepBookmark, managerModel, applied) {
  const disabled = applied ? ' disabled' : ''
  const appliedClass = applied ? ' applied' : ''

  return `
    <li class="cleanup-change cleanup-duplicate-change${appliedClass}">
      <section class="duplicate-group cleanup-duplicate-group">
        <header class="duplicate-header">
          <div>
            <h3>${escapeHtml(bookmark?.originalUrl || bookmark?.url || keepBookmark?.originalUrl || keepBookmark?.url || 'Duplicate bookmark')}</h3>
            ${renderCleanupReason(change.reason)}
          </div>
        </header>
        <ul class="duplicate-bookmarks">
          ${renderCleanupDuplicateBookmark(keepBookmark, true, managerModel)}
          ${renderCleanupDuplicateBookmark(bookmark, false, managerModel)}
        </ul>
      </section>
      <button class="button danger duplicate-delete-button" type="button" data-cleanup-change-type="deleteBookmarks"
        data-cleanup-change-index="${index}"${disabled}>
        ${renderTrashIcon()}
        <span>${applied ? 'Applied' : 'Accept Delete'}</span>
      </button>
    </li>
  `
}

function renderCleanupDuplicateBookmark(bookmark, isKeep, managerModel) {
  if (!bookmark) {
    return `
      <li class="duplicate-bookmark${isKeep ? ' keep-bookmark' : ''}">
        <div class="duplicate-details">
          <div class="duplicate-suggestion">
            <span class="badge ${isKeep ? 'suggestion-best' : 'suggestion-copy'}">${isKeep ? 'Keep' : 'Delete'}</span>
            <span>Bookmark not found</span>
          </div>
        </div>
      </li>
    `
  }

  const displayUrl = bookmark.originalUrl || bookmark.url || ''
  return `
    <li class="duplicate-bookmark${isKeep ? ' keep-bookmark' : ''}">
      <div class="duplicate-details">
        <div class="duplicate-suggestion">
          <span class="badge ${isKeep ? 'suggestion-best' : 'suggestion-copy'}">${isKeep ? 'Keep' : 'Delete'}</span>
          <span>${isKeep ? 'Bookmark to keep' : 'Proposed duplicate copy'}</span>
        </div>
        <div class="bookmark-title">${renderBookmarkTitle(bookmark)}</div>
        <div class="bookmark-meta">
          ${renderCleanupFolderForBookmark(bookmark, managerModel)}
          ${renderDateBadge(bookmark.dateAdded)}
          ${renderCleanupTags(bookmark.tagsArray || [])}
        </div>
        <div class="bookmark-url" title="${escapeHtml(displayUrl)}">${escapeHtml(displayUrl)}</div>
      </div>
    </li>
  `
}

function renderCleanupTags(tags) {
  return tags.map(renderCleanupTagLink).join(' ')
}

function renderCleanupTagLink(tag) {
  const href = createTagManagerHref({ name: tag })
  return `<a class="badge tags cleanup-badge-link" href="${escapeHtml(href)}" title="Open tag in Tag Manager">#${escapeHtml(
    tag,
  )}</a>`
}

function renderCleanupFolderForBookmark(bookmark, managerModel) {
  const label = bookmark.folderArray?.length ? bookmark.folderArray.join(' / ') : 'Root'
  const folder = {
    id: bookmark.folderId || findFolderOptionIdByLabel(managerModel, label),
    label,
  }
  return renderCleanupFolderLink(folder, label, managerModel)
}

function renderCleanupFolderLink(folder, label, managerModel) {
  const folderId = folder.id || findFolderOptionIdByLabel(managerModel, label) || 'all'
  const href = createFolderBookmarkHref({ id: folderId, name: label })
  return `<a class="badge folder cleanup-badge-link" href="${escapeHtml(
    href,
  )}" title="Open folder in Bookmark Manager">~${escapeHtml(label)}</a>`
}

function findFolderOptionIdByLabel(managerModel, label) {
  const folderOptions = managerModel?.folderOptions || []
  const key = String(label || '').toLowerCase()

  for (let i = 0; i < folderOptions.length; i++) {
    if (String(folderOptions[i].label || '').toLowerCase() === key) {
      return folderOptions[i].id
    }
  }

  return ''
}

function getFolderLabelById(managerModel, folderId) {
  const folder = findFolderById(managerModel?.folderTree, folderId)
  if (folder?.path?.length) {
    return folder.path.join(' / ')
  }
  if (folder?.title) {
    return folder.title
  }

  const folderOptions = managerModel?.folderOptions || []
  for (let i = 0; i < folderOptions.length; i++) {
    if (String(folderOptions[i].id) === String(folderId)) {
      return folderOptions[i].label || folderOptions[i].title || ''
    }
  }

  return ''
}

function countCleanupProposalChanges(proposal) {
  const changes = proposal?.changes || {}
  return (
    (changes.addTags?.length || 0) +
    (changes.removeTags?.length || 0) +
    (changes.renameTags?.length || 0) +
    (changes.moveBookmarks?.length || 0) +
    (changes.deleteBookmarks?.length || 0) +
    (changes.rewriteTitles?.length || 0)
  )
}

function formatPromptSize(prompt) {
  const bytes = new Blob([prompt]).size
  if (bytes < 1024) {
    return `${formatInteger(bytes)} B`
  }
  return `${(bytes / 1024).toLocaleString('en-US', { maximumFractionDigits: 1 })} KB`
}

function renderFolderTree(folder, activeFolderId) {
  if (!folder) {
    return '<p class="empty-state">No folders found.</p>'
  }

  return `
    <ul class="folder-tree-list">
      ${renderFolderNode(folder, activeFolderId)}
    </ul>
  `
}

function renderFolderNode(folder, activeFolderId) {
  const folderId = String(folder.id)
  const isActive = folderId === String(activeFolderId || 'all')
  const depth = Math.max(0, folder.depth || 0)
  const children = folder.children || []

  return `
    <li>
      <button class="folder-tree-button${isActive ? ' active' : ''}" type="button"
        data-manager-folder-id="${escapeHtml(folderId)}" style="--folder-depth: ${depth}">
        <span>${escapeHtml(folder.title)}</span>
        <small>${formatInteger(folder.totalCount || folder.count)}</small>
      </button>
      ${
        children.length
          ? `
            <ul>
              ${children.map((child) => renderFolderNode(child, activeFolderId)).join('')}
            </ul>
          `
          : ''
      }
    </li>
  `
}

function renderFolderOptions(folderOptions) {
  if (!folderOptions.length) {
    return '<option value="">No folders</option>'
  }

  return folderOptions
    .map((folder) => {
      const indent = '\u00a0\u00a0\u00a0\u00a0'.repeat(Math.max(0, folder.depth - 1))
      return `<option value="${escapeHtml(folder.id)}" title="${escapeHtml(folder.label)}">${indent}${escapeHtml(
        folder.title,
      )}</option>`
    })
    .join('')
}

function renderManagedBookmarkList(bookmarks, canUpdateBookmarks) {
  if (!bookmarks.length) {
    return '<p class="empty-state">No bookmarks match this view.</p>'
  }

  const renderCount = Math.min(bookmarks.length, MANAGED_BOOKMARK_RENDER_LIMIT)
  const renderedBookmarks = renderCount === bookmarks.length ? bookmarks : bookmarks.slice(0, renderCount)
  const limitNotice =
    bookmarks.length > renderCount
      ? `<p class="manager-note">Showing first ${formatInteger(renderCount)} of ${formatInteger(
          bookmarks.length,
        )} bookmarks. Search or choose a folder to narrow the list; Select Visible still selects all ${formatInteger(
          bookmarks.length,
        )} matching bookmarks.</p>`
      : ''
  const updateNotice = canUpdateBookmarks
    ? ''
    : '<p class="manager-note">Bookmark updates are unavailable in this preview context.</p>'

  return `
    ${updateNotice}
    ${limitNotice}
    <ul class="bookmark-list managed-bookmarks">
      ${renderedBookmarks.map((bookmark) => renderManagedBookmarkRow(bookmark, canUpdateBookmarks)).join('')}
    </ul>
  `
}

function renderManagedBookmarkRow(bookmark, canUpdateBookmarks) {
  const bookmarkId = String(bookmark.originalId)
  const selectedIds = ext.model.bookmarkManagerSelectedIds || new Set()
  const isSelected = selectedIds.has(bookmarkId) || isTemporaryManagedBookmarkSelected(bookmarkId)
  const checked = isSelected ? ' checked' : ''
  const selectedClass = checked ? ' selected' : ''
  const currentClass = String(ext.model.bookmarkManagerCurrentId || '') === bookmarkId ? ' current' : ''
  const disabled = canUpdateBookmarks ? '' : ' disabled'
  const disabledClass = canUpdateBookmarks ? '' : ' disabled'
  const displayUrl = bookmark.originalUrl || bookmark.url || ''

  return `
    <li class="bookmark managed-bookmark${selectedClass}${currentClass}${disabledClass}"
      data-managed-bookmark-row-id="${escapeHtml(bookmarkId)}">
      <label class="managed-bookmark-check">
        <input type="checkbox" data-managed-bookmark-id="${escapeHtml(bookmarkId)}"${checked}${disabled}>
      </label>
      <div class="managed-bookmark-main">
        <div class="title">
          <span class="title-text">${renderBookmarkTitle(bookmark)} </span>
          ${renderFolderBadge(bookmark.folderArray)}
          ${renderTagBadges(bookmark.tagsArray)}
        </div>
        <div class="url" title="${escapeHtml(displayUrl)}">${escapeHtml(displayUrl)}</div>
      </div>
    </li>
  `
}

function renderBrowserSummary(visibleCount, selectedCount) {
  const folderId = ext.model.bookmarkManagerFolderId || 'all'
  const query = ext.dom.manager.bookmarkSearch.value.trim()
  const folder = findFolderById(ext.model.bookmarkManager?.folderTree, folderId)
  const folderName = folderId === 'all' || !folder ? 'All Bookmarks' : folder.path.join(' / ')
  const searchText = query ? ` matching "${query}"` : ''

  return `${formatInteger(selectedCount)}/${formatInteger(visibleCount)} selected in ${folderName}${searchText}`
}

function updateManagedSelectionUi() {
  const dom = ext.dom.manager
  const selectedIds = getSelectedManagedBookmarkIds()
  const selectedCount = selectedIds.length
  const currentBookmark = findBookmarkById(
    ext.model.bookmarkManager?.bookmarks || [],
    ext.model.bookmarkManagerCurrentId,
  )
  const targetIds = getManagedActionTargetIds()
  const canUpdateBookmarks = Boolean(ext.model.bookmarkManagerCanUpdateBookmarks)
  const canMoveBookmarks = Boolean(ext.model.bookmarkManagerCanMoveBookmarks)
  const canEditCurrentBookmark = canEditCurrentManagedBookmark(currentBookmark, selectedIds, canUpdateBookmarks)
  const canOpenBookmarkEditor = canEditCurrentBookmark
  const isSuggestingTags = Boolean(ext.model.bookmarkManagerSuggestingTags)
  const hasBulkTags = getManagerTagInputValues('bulk').length > 0
  const canApplyBulkTags = Boolean(targetIds.length && canUpdateBookmarks && hasBulkTags && !isSuggestingTags)
  const canEditBulkTags = Boolean(targetIds.length && canUpdateBookmarks && !isSuggestingTags)

  dom.bookmarkBrowserSummary.textContent = renderBrowserSummary(
    ext.model.bookmarkManagerVisibleBookmarks?.length || 0,
    getVisibleManagedSelectionCount(selectedIds, currentBookmark),
  )
  dom.bookmarkSelectionSummary.textContent = renderActionTargetSummary(selectedCount, currentBookmark)
  dom.moveSelectedBookmarks.disabled = !targetIds.length || !canMoveBookmarks || !dom.bookmarkMoveFolder.value
  dom.addTagsSelected.disabled = !canApplyBulkTags
  dom.replaceTagsSelected.disabled = !canApplyBulkTags
  dom.removeTagsSelected.disabled = !canApplyBulkTags
  dom.suggestTagsSelected.textContent = getTagSuggestionButtonLabel(targetIds, isSuggestingTags)
  dom.suggestTagsSelected.disabled = isSuggestingTags || !targetIds.length || !ext.model.bookmarkManagerLocalAiAvailable
  dom.saveManagedBookmark.disabled = !canEditCurrentBookmark
  dom.bookmarkEditTitle.disabled = !canEditCurrentBookmark
  dom.bookmarkEditUrl.disabled = !canEditCurrentBookmark
  dom.bookmarkEditTags.disabled = !canEditCurrentBookmark
  dom.bookmarkEditScore.disabled = !canEditCurrentBookmark
  dom.openBookmarkEditor.href = canOpenBookmarkEditor
    ? `./editBookmark.html#bookmark/${encodeURIComponent(String(currentBookmark.originalId))}`
    : './editBookmark.html'
  dom.openBookmarkEditor.setAttribute('aria-disabled', canOpenBookmarkEditor ? 'false' : 'true')
  dom.openBookmarkEditor.tabIndex = canOpenBookmarkEditor ? 0 : -1
  dom.bulkTagsInput.disabled = !canEditBulkTags

  if (selectedCount > 1) {
    dom.bookmarkEditTitle.value = '<< multiple selection >>'
    dom.bookmarkEditUrl.value = '<< multiple selection >>'
    dom.bookmarkEditScore.value = ''
    setManagerTagControlValues(ext, 'edit', [])
  } else if (currentBookmark) {
    dom.bookmarkEditTitle.value = currentBookmark.title || ''
    dom.bookmarkEditUrl.value = currentBookmark.originalUrl || ''
    dom.bookmarkEditScore.value = String(currentBookmark.customBonusScore || 0)
    setManagerTagControlValues(ext, 'edit', currentBookmark.tagsArray || [])
  } else {
    dom.bookmarkEditTitle.value = ''
    dom.bookmarkEditUrl.value = ''
    dom.bookmarkEditScore.value = ''
    setManagerTagControlValues(ext, 'edit', [])
  }

  setManagerTagControlDisabled(ext, 'edit', !canEditCurrentBookmark)
  setManagerTagControlDisabled(ext, 'bulk', !canEditBulkTags)
  syncManagedBookmarkCheckboxes()
  syncManagedBookmarkSelectionRows()
}

function getTagSuggestionButtonLabel(targetIds, isSuggestingTags) {
  if (isSuggestingTags) {
    return 'Suggesting...'
  }

  const targetKey = targetIds.join('|')
  const canRetry = Boolean(
    targetKey &&
      ext.model.bookmarkManagerTagSuggestionRetryCount > 0 &&
      ext.model.bookmarkManagerTagSuggestionRetryKey === targetKey,
  )

  return canRetry ? 'Suggest tags (try again)' : 'Suggest tags'
}

function renderActionTargetSummary(selectedCount, currentBookmark) {
  if (selectedCount) {
    return `${formatInteger(selectedCount)} selected bookmark${selectedCount === 1 ? '' : 's'}`
  }

  if (currentBookmark) {
    return '1 selected bookmark'
  }

  return 'Click a bookmark or check bookmarks.'
}

function getVisibleManagedSelectionCount(selectedIds, currentBookmark) {
  const visibleBookmarks = ext.model.bookmarkManagerVisibleBookmarks || []

  if (selectedIds.length) {
    let selectedVisibleCount = 0
    const selectedIdSet = new Set(selectedIds.map(String))

    for (let i = 0; i < visibleBookmarks.length; i++) {
      if (selectedIdSet.has(String(visibleBookmarks[i].originalId))) {
        selectedVisibleCount += 1
      }
    }

    return selectedVisibleCount
  }

  if (!currentBookmark) {
    return 0
  }

  const currentId = String(currentBookmark.originalId)
  for (let i = 0; i < visibleBookmarks.length; i++) {
    if (String(visibleBookmarks[i].originalId) === currentId) {
      return 1
    }
  }

  return 0
}

function selectVisibleManagedBookmarks() {
  const selectedIds = ext.model.bookmarkManagerSelectedIds || new Set()
  ext.model.bookmarkManagerSelectedIds = selectedIds
  ext.model.bookmarkManagerHasManualSelection = true
  const visibleIds = getVisibleManagedBookmarkIds()

  for (let i = 0; i < visibleIds.length; i++) {
    selectedIds.add(visibleIds[i])
  }

  syncManagedBookmarkCheckboxes()
  syncManagedBookmarkSelectionRows()
}

function setCurrentManagedBookmark(bookmarkId) {
  ext.model.bookmarkManagerCurrentId = String(bookmarkId || '')
}

function syncManagedBookmarkCheckboxes() {
  const selectedIds = ext.model.bookmarkManagerSelectedIds || new Set()
  const inputs = document.querySelectorAll('[data-managed-bookmark-id]')

  for (const input of inputs) {
    input.checked =
      selectedIds.has(input.dataset.managedBookmarkId) ||
      isTemporaryManagedBookmarkSelected(input.dataset.managedBookmarkId)
  }
}

function syncManagedBookmarkSelectionRows() {
  const selectedIds = ext.model.bookmarkManagerSelectedIds || new Set()
  const currentId = String(ext.model.bookmarkManagerCurrentId || '')
  const rows = document.querySelectorAll('[data-managed-bookmark-row-id]')

  for (const row of rows) {
    const bookmarkId = String(row.dataset.managedBookmarkRowId)
    row.classList.toggle('selected', selectedIds.has(bookmarkId) || isTemporaryManagedBookmarkSelected(bookmarkId))
    row.classList.toggle('current', bookmarkId === currentId)
  }
}

function isTemporaryManagedBookmarkSelected(bookmarkId) {
  return getTemporaryManagedBookmarkSelectedId() === String(bookmarkId || '')
}

function getTemporaryManagedBookmarkSelectedId() {
  if (ext.model.bookmarkManagerHasManualSelection) {
    return ''
  }

  const selectedIds = ext.model.bookmarkManagerSelectedIds || new Set()
  if (selectedIds.size) {
    return ''
  }

  return String(ext.model.bookmarkManagerCurrentId || '')
}

function renderTagManager(canUpdateBookmarks) {
  const tagGroups = ext.model.bookmarkManager?.tagGroups || []
  const filter = ext.model.bookmarkManagerTagFilter || ''
  const visibleTags = filter ? tagGroups.filter((tag) => tag.name.toLowerCase().includes(filter)) : tagGroups

  if (!tagGroups.length) {
    return '<p class="empty-state">No bookmark tags were found.</p>'
  }

  const updateNotice = canUpdateBookmarks
    ? ''
    : '<p class="manager-note">Tag updates are unavailable in this preview context.</p>'

  if (!visibleTags.length) {
    return `${updateNotice}<p class="empty-state">No tags match this filter.</p>`
  }

  const selectedTag = getSelectedTag(visibleTags)

  return `
    ${updateNotice}
    <div class="tag-manager-layout">
      <ol class="tag-manager-list">
        ${visibleTags.map((tag) => renderTagManagerRow(tag, selectedTag)).join('')}
      </ol>
      ${renderTagBookmarkPanel(selectedTag, canUpdateBookmarks)}
    </div>
  `
}

function getSelectedTag(visibleTags) {
  const selectedName = ext.model.bookmarkManagerSelectedTag
  const selectedTag = visibleTags.find((tag) => tag.name === selectedName)
  const nextTag = selectedTag || visibleTags[0]
  ext.model.bookmarkManagerSelectedTag = nextTag.name
  return nextTag
}

function renderTagManagerRow(tag, selectedTag) {
  const safeName = escapeHtml(tag.name)
  const isActive = tag.name === selectedTag.name

  return `
    <li class="${isActive ? 'active' : ''}">
      <button class="tag-manager-select" type="button" data-select-tag="${safeName}" aria-pressed="${isActive}">
        <div class="tag-manager-main">
          <span class="badge tags">#${safeName}</span>
          <span class="tag-manager-count">${formatInteger(tag.count)} ${
            tag.count === 1 ? 'bookmark' : 'bookmarks'
          }</span>
        </div>
      </button>
    </li>
  `
}

function renderTagBookmarkPanel(tag, canUpdateBookmarks) {
  const bookmarks = getBookmarksForTag(tag)
  const disabled = canUpdateBookmarks ? '' : ' disabled'

  if (!bookmarks.length) {
    return `
      <section class="tag-bookmark-panel">
        ${renderTagBookmarkPanelHeader(tag, 0, disabled)}
        <p class="empty-state">No bookmarks use this tag.</p>
      </section>
    `
  }

  const renderCount = Math.min(bookmarks.length, TAG_BOOKMARK_RENDER_LIMIT)
  const renderedBookmarks = renderCount === bookmarks.length ? bookmarks : bookmarks.slice(0, renderCount)
  const limitNotice =
    bookmarks.length > renderCount
      ? `<p class="manager-note">Showing first ${formatInteger(renderCount)} of ${formatInteger(
          bookmarks.length,
        )} bookmarks for this tag.</p>`
      : ''

  return `
    <section class="tag-bookmark-panel">
      ${renderTagBookmarkPanelHeader(tag, bookmarks.length, disabled)}
      ${limitNotice}
      <ul class="bookmark-list tag-bookmark-list">
        ${renderedBookmarks.map(renderBookmarkListItem).join('')}
      </ul>
    </section>
  `
}

function renderTagBookmarkPanelHeader(tag, bookmarkCount, disabled) {
  const safeName = escapeHtml(tag.name)

  return `
    <header class="tag-bookmark-panel-header">
      <div class="tag-bookmark-panel-title">
        <h3>#${safeName}</h3>
        <p>${formatInteger(bookmarkCount)} ${bookmarkCount === 1 ? 'bookmark' : 'bookmarks'}</p>
      </div>
      <div class="tag-manager-actions">
        <button class="button secondary tag-rename-button" type="button" data-rename-tag="${safeName}"${disabled}>
          Rename
        </button>
        <button class="button danger tag-remove-button" type="button" data-remove-tag="${safeName}"${disabled}>
          Remove
        </button>
      </div>
    </header>
  `
}

function getBookmarksForTag(tag) {
  const bookmarkIds = new Set(tag.bookmarkIds)
  const bookmarks = ext.model.bookmarkManager?.bookmarks || []
  const taggedBookmarks = []

  for (let i = 0; i < bookmarks.length; i++) {
    if (bookmarkIds.has(String(bookmarks[i].originalId))) {
      taggedBookmarks.push(bookmarks[i])
    }
  }

  return taggedBookmarks
}

function renderTagManagerIntoDom(canUpdateBookmarks) {
  const tagList = ext.dom.manager?.tagList
  if (!tagList) {
    return
  }

  tagList.innerHTML = renderTagManager(canUpdateBookmarks)
  scrollSelectedTagIntoView()
}

function applyTagManagerUrlState() {
  if (window.location.hash !== '#tags') {
    return
  }

  const tagName = new URLSearchParams(window.location.search).get('tag')
  if (!tagName) {
    return
  }

  ext.model.bookmarkManagerSelectedTag = tagName
  ext.model.bookmarkManagerTagFilter = ''

  if (ext.dom.manager?.tagFilter) {
    ext.dom.manager.tagFilter.value = ''
  }
}

function scrollSelectedTagIntoView() {
  const activeTag = ext.dom.manager?.tagList?.querySelector('.tag-manager-list .active .tag-manager-select')
  if (typeof activeTag?.scrollIntoView === 'function') {
    activeTag.scrollIntoView({ block: 'nearest' })
  }
}

function renderRecentBookmarksIntoDom() {
  const bookmarks = ext.model.bookmarkManager?.bookmarks || []
  const result = renderRecentBookmarks(bookmarks, ext.model.bookmarkManagerRecentPage || 1)
  ext.model.bookmarkManagerRecentPage = result.page
  ext.dom.manager.recentBookmarks.innerHTML = result.html
}

function selectSuggestedDuplicates() {
  selectSuggestedDuplicateBookmarks()
  updateDuplicateActions()
}

function clearDuplicateSelection() {
  clearDuplicateBookmarkSelection()
  updateDuplicateActions()
}

function updateDuplicateActions() {
  updateDuplicateSelectionAction(ext.dom.manager.deleteSelected)
}

function renderBookmarkUndoItem(snapshot, canRestore) {
  const timestamp = Number.isFinite(snapshot.createdAt) ? formatUndoTimestamp(snapshot.createdAt) : ''
  const disabled = canRestore ? '' : ' disabled'
  const detailsHtml = renderUndoSnapshotDetails(snapshot)

  return `
    <li class="bookmark-undo-item">
      <div class="bookmark-undo-description">
        ${detailsHtml}
        ${timestamp ? `<div class="bookmark-undo-time">${escapeHtml(timestamp)}</div>` : ''}
      </div>
      <button class="button secondary" type="button" data-undo-snapshot-id="${escapeHtml(snapshot.id)}"${disabled}>
        Undo
      </button>
    </li>
  `
}

function renderUndoSnapshotDetails(snapshot) {
  const metadata = snapshot.metadata || {}
  const actionLabel = getUndoActionLabel(metadata.action) || snapshot.description
  const metadataHtml = renderUndoMetadata(metadata)
  const affectedHtml = renderUndoSnapshotBookmarks(snapshot.bookmarks || [])

  return `
    <div class="bookmark-undo-action">${escapeHtml(actionLabel)}</div>
    ${metadataHtml}
    ${affectedHtml}
  `
}

function getUndoActionLabel(action) {
  if (action === 'editBookmark') return 'Edited bookmark'
  if (action === 'moveBookmarks') return 'Moved bookmarks'
  if (action === 'addTags') return 'Added tags'
  if (action === 'removeTags') return 'Removed tags'
  if (action === 'updateTags') return 'Changed tags'
  if (action === 'renameTag') return 'Renamed tag'
  if (action === 'deleteBookmarks') return 'Deleted bookmarks'
  if (action === 'aiCleanup') return 'Applied AI cleanup'
  return ''
}

function renderUndoMetadata(metadata) {
  const parts = []

  if (metadata.tagsAdded?.length) {
    parts.push(`<span>Added ${renderUndoTagLinks(metadata.tagsAdded)}</span>`)
  }
  if (metadata.tagsRemoved?.length) {
    parts.push(`<span>Removed ${renderUndoTagLinks(metadata.tagsRemoved)}</span>`)
  }
  if (metadata.tagRenames?.length) {
    parts.push(...metadata.tagRenames.map(renderUndoTagRename))
  }
  if (metadata.targetFolderId || metadata.targetFolderLabel) {
    parts.push(`<span>Folder ${renderUndoFolderLink(metadata)}</span>`)
  }

  return parts.length ? `<div class="bookmark-undo-metadata">${parts.join(' ')}</div>` : ''
}

function renderUndoTagLinks(tags) {
  return tags.map(renderCleanupTagLink).join(' ')
}

function renderUndoTagRename(rename) {
  return `<span>${renderCleanupTagLink(rename.from)} to ${renderCleanupTagLink(rename.to)}</span>`
}

function renderUndoFolderLink(metadata) {
  const label = metadata.targetFolderLabel || metadata.targetFolderId || 'Unknown Folder'
  return renderCleanupFolderLink({ id: metadata.targetFolderId, label }, label, ext.model.bookmarkManager)
}

function renderUndoSnapshotBookmarks(bookmarks) {
  if (!bookmarks.length) return ''

  const limit = 3
  const titles = []

  for (let i = 0; i < bookmarks.length && i < limit; i++) {
    const label = bookmarks[i].title || bookmarks[i].url || ''
    if (label) {
      titles.push(`<span class="bookmark-undo-bookmark">${escapeHtml(label)}</span>`)
    }
  }

  if (!titles.length) return ''

  const remaining = bookmarks.length - limit
  const suffix = remaining > 0 ? ` and ${remaining} more` : ''

  return `<div class="bookmark-undo-bookmarks">${titles.join('')}${suffix}</div>`
}

function formatUndoTimestamp(timestamp) {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}
