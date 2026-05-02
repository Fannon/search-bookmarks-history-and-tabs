/**
 * @file Renders the dedicated bookmark manager page.
 */

import { escapeHtml } from '../helper/utils.js'

const RECENT_BOOKMARKS_PER_PAGE = 24

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

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
    addTagsSelected: document.getElementById('add-tags-selected'),
    replaceTagsSelected: document.getElementById('replace-tags-selected'),
    removeTagsSelected: document.getElementById('remove-tags-selected'),
    bookmarkEditTitle: document.getElementById('bookmark-edit-title'),
    bookmarkEditUrl: document.getElementById('bookmark-edit-url'),
    bookmarkEditTags: document.getElementById('bookmark-edit-tags'),
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
    deleteSelected: document.getElementById('delete-selected'),
    selectSuggested: document.getElementById('select-suggested'),
    selectNone: document.getElementById('select-none'),
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
  dom.topTags.innerHTML = renderTopList(stats.topTags, 'No tags found')
  dom.topDomains.innerHTML = renderTopList(stats.topDomains, 'No domains found')
  dom.topFolders.innerHTML = renderTopList(stats.topFolders, 'No folders found')
  dom.recentBookmarks.innerHTML = renderRecentBookmarks(model.bookmarks)
  dom.bookmarkCount.textContent = stats.bookmarkCount ? String(stats.bookmarkCount) : ''
  dom.duplicateSummary.innerHTML = renderDuplicateSummary(stats)
  dom.duplicateCount.textContent = stats.duplicateGroupCount ? String(stats.duplicateGroupCount) : ''
  dom.tagSummary.innerHTML = renderTagSummary(stats)
  dom.tagCount.textContent = stats.uniqueTagCount ? String(stats.uniqueTagCount) : ''
  dom.duplicatesList.innerHTML = renderDuplicates(model.duplicateGroups, canModifyBookmarks)
  ext.model.bookmarkManagerCanUpdateBookmarks = canUpdateBookmarks
  ext.model.bookmarkManagerCanMoveBookmarks = typeof ext.browserApi.bookmarks?.move === 'function'
  ext.model.bookmarkManagerSelectedIds ||= new Set()
  ext.model.bookmarkManagerVisibleBookmarks = model.bookmarks
  renderBookmarkWorkspace(model.bookmarks, canUpdateBookmarks, ext.model.bookmarkManagerCanMoveBookmarks)
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
}) {
  const dom = ext.dom.manager

  dom.refreshBookmarks.addEventListener('click', onRefresh)
  dom.bookmarkSearch.addEventListener('input', onBookmarkSearch)
  dom.bookmarkFolderTree.addEventListener('click', (event) => {
    const button = event.target.closest('[data-manager-folder-id]')
    if (!button) {
      return
    }

    ext.model.bookmarkManagerFolderId = button.dataset.managerFolderId
    onBookmarkSearch()
  })
  dom.managedBookmarkList.addEventListener('change', (event) => {
    if (!event.target.matches('[data-managed-bookmark-id]')) {
      return
    }

    setCurrentManagedBookmark(event.target.dataset.managedBookmarkId)
    onSelectBookmark(event.target.dataset.managedBookmarkId, event.target.checked)
    syncManagedBookmarkSelectionRows()
  })
  dom.managedBookmarkList.addEventListener('click', (event) => {
    const row = event.target.closest('[data-managed-bookmark-row-id]')
    if (!row || event.target.closest('a, button, input')) {
      return
    }

    setCurrentManagedBookmark(row.dataset.managedBookmarkRowId)
    updateManagedSelectionUi()
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
      selectSuggestedGroup(group)
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

/**
 * Display a small status message in the manager toolbar.
 *
 * @param {string} message Status message.
 * @param {'info'|'error'|'success'} [tone='info'] Message tone.
 */
export function showManagerStatus(message, tone = 'info') {
  const status = ext.dom.manager?.status
  if (!status) {
    return
  }

  status.textContent = message
  status.dataset.tone = tone
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

  dom.suggestTagsSelected.textContent = busy ? 'Suggesting...' : 'Suggest tags'
  dom.suggestTagsSelected.setAttribute('aria-busy', busy ? 'true' : 'false')
  dom.suggestTagsSelected.title = busy
    ? message || 'Suggesting tags with local AI'
    : 'Suggest tags for checked bookmarks, or the current bookmark if none are checked'
  updateManagedSelectionUi()
}

/**
 * Return selected duplicate bookmark IDs.
 *
 * @returns {Array<string>} Selected bookmark IDs.
 */
export function getSelectedDuplicateIds() {
  return [...document.querySelectorAll('[data-delete-bookmark-id]:checked:not(:disabled)')].map(
    (input) => input.dataset.deleteBookmarkId,
  )
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
  const tagify = _source === 'edit' ? ext.managerEditTagify : ext.managerBulkTagify
  if (tagify) {
    return normalizeTagValues(tagify.value.map((tag) => tag.value))
  }

  const input = _source === 'edit' ? ext.dom.manager.bookmarkEditTags : ext.dom.manager.bulkTagsInput
  return normalizeTagValues(String(input.value || '').split(/[#,]/))
}

/**
 * Read the single-edit form values.
 *
 * @returns {{title: string, url: string, tags: Array<string>}} Form values.
 */
export function getManagedBookmarkEditValues() {
  const dom = ext.dom.manager
  return {
    title: dom.bookmarkEditTitle.value.trim(),
    url: dom.bookmarkEditUrl.value.trim(),
    tags: getManagerTagInputValues('edit'),
  }
}

/**
 * Fill one of the manager tag controls with suggested tags.
 *
 * @param {'bulk'|'edit'} target Tag input target.
 * @param {Array<string>} tags Tag names.
 */
export function addManagerTagInputValues(target, tags) {
  const tagify = target === 'edit' ? ext.managerEditTagify : ext.managerBulkTagify
  const input = target === 'edit' ? ext.dom.manager.bookmarkEditTags : ext.dom.manager.bulkTagsInput
  const currentTags = getManagerTagInputValues(target)
  const nextTags = normalizeTagValues(currentTags.concat(tags))

  if (target === 'bulk') {
    ext.model.bookmarkManagerSuggestedTagsReady = Boolean(nextTags.length)
    setTagifyDisabled(tagify, false)
    input.disabled = false
  }

  setTagifyValues(tagify, input, nextTags)

  if (target === 'bulk') {
    setTagifyDisabled(tagify, !nextTags.length)
    input.disabled = !nextTags.length
    updateManagedSelectionUi()
  }
}

/**
 * Clear and disable suggested tag controls.
 */
export function clearManagerSuggestedTags() {
  const dom = ext.dom.manager
  ext.model.bookmarkManagerSuggestedTagsReady = false
  setTagifyValues(ext.managerBulkTagify, dom.bulkTagsInput, [])
  setTagifyDisabled(ext.managerBulkTagify, true)
  dom.bulkTagsInput.disabled = true
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
  dom.bookmarkBrowserSummary.textContent = renderBrowserSummary(visibleBookmarks.length, model.bookmarks.length)

  ensureManagerTagify()
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
    hash === '#bookmarks' || hash === '#duplicates' || hash === '#tags' || hash === '#overview'
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
      const indent = '\u00a0\u00a0'.repeat(Math.max(0, folder.depth - 1))
      return `<option value="${escapeHtml(folder.id)}">${indent}${escapeHtml(folder.label)}</option>`
    })
    .join('')
}

function renderManagedBookmarkList(bookmarks, canUpdateBookmarks) {
  if (!bookmarks.length) {
    return '<p class="empty-state">No bookmarks match this view.</p>'
  }

  const updateNotice = canUpdateBookmarks
    ? ''
    : '<p class="manager-note">Bookmark updates are unavailable in this preview context.</p>'

  return `
    ${updateNotice}
    <ul class="bookmark-list managed-bookmarks">
      ${bookmarks.map((bookmark) => renderManagedBookmarkRow(bookmark, canUpdateBookmarks)).join('')}
    </ul>
  `
}

function renderManagedBookmarkRow(bookmark, canUpdateBookmarks) {
  const bookmarkId = String(bookmark.originalId)
  const selectedIds = ext.model.bookmarkManagerSelectedIds || new Set()
  const checked = selectedIds.has(bookmarkId) ? ' checked' : ''
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

function renderBrowserSummary(visibleCount, totalCount) {
  const folderId = ext.model.bookmarkManagerFolderId || 'all'
  const query = ext.dom.manager.bookmarkSearch.value.trim()
  const folder = findFolderById(ext.model.bookmarkManager?.folderTree, folderId)
  const folderName = folderId === 'all' || !folder ? 'All Bookmarks' : folder.path.join(' / ')
  const searchText = query ? ` matching "${query}"` : ''

  return `${formatInteger(visibleCount)} of ${formatInteger(totalCount)} bookmarks in ${folderName}${searchText}`
}

function ensureManagerTagify() {
  const tags = (ext.model.bookmarkManager?.tagGroups || []).map((tag) => tag.name)

  ext.managerBulkTagify = ensureTagify(ext.dom.manager.bulkTagsInput, ext.managerBulkTagify, tags)
  ext.managerEditTagify = ensureTagify(ext.dom.manager.bookmarkEditTags, ext.managerEditTagify, tags)
}

function ensureTagify(input, currentTagify, whitelist) {
  if (!input || typeof Tagify === 'undefined') {
    return currentTagify
  }

  if (currentTagify) {
    currentTagify.whitelist = whitelist
    return currentTagify
  }

  return new Tagify(input, {
    whitelist,
    trim: true,
    transformTag,
    skipInvalid: false,
    editTags: {
      clicks: 1,
      keepInvalid: false,
    },
    dropdown: {
      position: 'all',
      enabled: 0,
      maxItems: 12,
      closeOnSelect: false,
    },
  })
}

function updateManagedSelectionUi() {
  const dom = ext.dom.manager
  const selectedIds = getSelectedManagedBookmarkIds()
  const selectedCount = selectedIds.length
  const currentBookmark = findBookmarkById(ext.model.bookmarkManagerCurrentId)
  const targetIds = getManagedActionTargetIds()
  const canUpdateBookmarks = Boolean(ext.model.bookmarkManagerCanUpdateBookmarks)
  const canMoveBookmarks = Boolean(ext.model.bookmarkManagerCanMoveBookmarks)
  const canEditCurrentBookmark = Boolean(currentBookmark && selectedCount <= 1 && canUpdateBookmarks)
  const isSuggestingTags = Boolean(ext.model.bookmarkManagerSuggestingTags)
  const hasSuggestedTags = getManagerTagInputValues('bulk').length > 0
  const suggestedTagsReady = Boolean(ext.model.bookmarkManagerSuggestedTagsReady && hasSuggestedTags)
  const canApplySuggestedTags = Boolean(
    targetIds.length && canUpdateBookmarks && suggestedTagsReady && !isSuggestingTags,
  )

  dom.bookmarkSelectionSummary.textContent = renderActionTargetSummary(selectedCount, currentBookmark)
  dom.moveSelectedBookmarks.disabled = !targetIds.length || !canMoveBookmarks || !dom.bookmarkMoveFolder.value
  dom.addTagsSelected.disabled = !canApplySuggestedTags
  dom.replaceTagsSelected.disabled = !canApplySuggestedTags
  dom.removeTagsSelected.disabled = !canApplySuggestedTags
  dom.suggestTagsSelected.disabled = isSuggestingTags || !targetIds.length || !ext.model.bookmarkManagerLocalAiAvailable
  dom.saveManagedBookmark.disabled = !canEditCurrentBookmark
  dom.bookmarkEditTitle.disabled = !canEditCurrentBookmark
  dom.bookmarkEditUrl.disabled = !canEditCurrentBookmark
  dom.bookmarkEditTags.disabled = !canEditCurrentBookmark
  dom.bulkTagsInput.disabled = !suggestedTagsReady || isSuggestingTags

  if (selectedCount > 1) {
    dom.bookmarkEditTitle.value = 'multiple selection'
    dom.bookmarkEditUrl.value = 'multiple selection'
    setTagifyValues(ext.managerEditTagify, dom.bookmarkEditTags, [])
  } else if (currentBookmark) {
    dom.bookmarkEditTitle.value = currentBookmark.title || ''
    dom.bookmarkEditUrl.value = currentBookmark.originalUrl || ''
    setTagifyValues(ext.managerEditTagify, dom.bookmarkEditTags, currentBookmark.tagsArray || [])
  } else {
    dom.bookmarkEditTitle.value = ''
    dom.bookmarkEditUrl.value = ''
    setTagifyValues(ext.managerEditTagify, dom.bookmarkEditTags, [])
  }

  setTagifyDisabled(ext.managerEditTagify, !canEditCurrentBookmark)
  setTagifyDisabled(ext.managerBulkTagify, !suggestedTagsReady || isSuggestingTags)
  syncManagedBookmarkSelectionRows()
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

function selectVisibleManagedBookmarks() {
  const selectedIds = ext.model.bookmarkManagerSelectedIds || new Set()
  ext.model.bookmarkManagerSelectedIds = selectedIds
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
    input.checked = selectedIds.has(input.dataset.managedBookmarkId)
  }
}

function syncManagedBookmarkSelectionRows() {
  const selectedIds = ext.model.bookmarkManagerSelectedIds || new Set()
  const currentId = String(ext.model.bookmarkManagerCurrentId || '')
  const rows = document.querySelectorAll('[data-managed-bookmark-row-id]')

  for (const row of rows) {
    const bookmarkId = String(row.dataset.managedBookmarkRowId)
    row.classList.toggle('selected', selectedIds.has(bookmarkId))
    row.classList.toggle('current', bookmarkId === currentId)
  }
}

function setTagifyValues(tagify, input, tags) {
  if (tagify) {
    tagify.removeAllTags()
    if (tags.length) {
      tagify.addTags(tags)
    }
    return
  }

  input.value = tags.join(', ')
}

function setTagifyDisabled(tagify, disabled) {
  if (tagify && typeof tagify.setDisabled === 'function') {
    tagify.setDisabled(disabled)
  }
}

function normalizeTagValues(tags) {
  const seen = new Set()
  const result = []

  for (let i = 0; i < tags.length; i++) {
    const value = String(tags[i] || '')
      .replaceAll('#', '')
      .replace(/\s+/g, ' ')
      .trim()
    const key = value.toLowerCase()

    if (!value || seen.has(key)) {
      continue
    }

    seen.add(key)
    result.push(value)
  }

  return result
}

function transformTag(tagData) {
  if (tagData.value.includes('#')) {
    tagData.value = tagData.value.split('#').join('')
  }
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

function renderStats(stats) {
  return [
    renderStat('Bookmarks', formatInteger(stats.bookmarkCount), 'Total bookmark entries', '#bookmarks', 'bookmark'),
    renderStat(
      'Duplicates',
      formatInteger(stats.duplicateGroupCount),
      `${formatInteger(stats.removableDuplicateCount)} removable copies`,
      '#duplicates',
      'duplicate',
    ),
    renderStat(
      'Tagged',
      formatInteger(stats.taggedBookmarkCount),
      `${formatInteger(stats.untaggedBookmarkCount)} without tags`,
      '#tags',
      'tag',
      'Manage tags',
    ),
    renderStat(
      'Unique Tags',
      formatInteger(stats.uniqueTagCount),
      `${formatInteger(stats.tagAssignmentCount)} tag assignments`,
      '#tags',
      'tag',
      'Manage tags',
    ),
    renderStat(
      'Avg Tags',
      formatDecimal(stats.averageTagsPerBookmark),
      `${formatDecimal(stats.averageTagsPerTaggedBookmark)} on tagged bookmarks`,
      '#tags',
      'tag',
      'Manage tags',
    ),
    renderStat('Domains', formatInteger(stats.uniqueDomainCount), 'Unique URL hostnames', undefined, 'domain'),
  ].join('')
}

function renderStat(label, value, detail, href, tone = '', title = '') {
  const tagName = href ? 'a' : 'article'
  const hrefAttribute = href ? ` href="${escapeHtml(href)}"` : ''
  const titleAttribute = href ? ` title="${escapeHtml(title || `Open ${label}`)}"` : ''
  const linkClass = href ? ' stat-link' : ''
  const toneClass = tone ? ` stat-${tone}` : ''

  return `
    <${tagName} class="stat${linkClass}${toneClass}"${hrefAttribute}${titleAttribute}>
      <div class="stat-label">${escapeHtml(label)}</div>
      <div class="stat-value">${escapeHtml(value)}</div>
      <div class="stat-detail">${escapeHtml(detail)}</div>
    </${tagName}>
  `
}

function renderTagSummary(stats) {
  if (!stats.uniqueTagCount) {
    return '<p>No bookmark tags were found.</p>'
  }

  return `
    <p>${formatInteger(stats.uniqueTagCount)} unique tags are assigned ${formatInteger(
      stats.tagAssignmentCount,
    )} times across ${formatInteger(stats.taggedBookmarkCount)} tagged bookmarks.</p>
  `
}

function renderTopList(items, emptyText) {
  if (!items.length) {
    return `<p class="empty-state">${escapeHtml(emptyText)}</p>`
  }

  return `
    <ol class="rank-list">
      ${items
        .map(
          (item) => `
            <li>
              <span class="rank-name">${escapeHtml(item.name)}</span>
              <span class="rank-count">${formatInteger(item.count)}</span>
            </li>
          `,
        )
        .join('')}
    </ol>
  `
}

function renderRecentBookmarks(bookmarks) {
  const recentBookmarks = bookmarks
    .filter((bookmark) => Number.isFinite(bookmark.dateAdded))
    .slice()
    .sort((a, b) => b.dateAdded - a.dateAdded)

  if (!recentBookmarks.length) {
    return '<p class="empty-state">No bookmark date metadata found.</p>'
  }

  const pageCount = Math.ceil(recentBookmarks.length / RECENT_BOOKMARKS_PER_PAGE)
  const currentPage = clampRecentPage(ext.model.bookmarkManagerRecentPage || 1, pageCount)
  ext.model.bookmarkManagerRecentPage = currentPage

  const startIndex = (currentPage - 1) * RECENT_BOOKMARKS_PER_PAGE
  const pageBookmarks = recentBookmarks.slice(startIndex, startIndex + RECENT_BOOKMARKS_PER_PAGE)

  return `
    <ul class="bookmark-list recent-bookmark-list">
      ${pageBookmarks.map(renderBookmarkListItem).join('')}
    </ul>
    ${renderRecentPagination(currentPage, pageCount, recentBookmarks.length)}
  `
}

function renderBookmarkListItem(bookmark) {
  const displayUrl = bookmark.originalUrl || bookmark.url || ''
  const bookmarkId = bookmark.originalId !== undefined ? String(bookmark.originalId) : ''
  const originalId = bookmarkId ? ` x-original-id="${escapeHtml(bookmarkId)}"` : ''
  const openBookmark = bookmarkId ? ` data-open-managed-bookmark-id="${escapeHtml(bookmarkId)}"` : ''
  const openUrl = displayUrl ? ` x-open-url="${escapeHtml(displayUrl)}"` : ''

  return `
    <li class="bookmark"${openUrl}${originalId}${openBookmark}>
      <div class="recent-bookmark-main">
        <div class="title">
          <span class="title-text">${renderBookmarkTitle(bookmark)} </span>
          ${renderDateBadge(bookmark.dateAdded)}
          ${renderFolderBadge(bookmark.folderArray)}
          ${renderTagBadges(bookmark.tagsArray)}
        </div>
        <div class="url" title="${escapeHtml(displayUrl)}">${escapeHtml(displayUrl)}</div>
      </div>
    </li>
  `
}

function renderTrashIcon() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />
      <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
    </svg>
  `
}

function renderDuplicateSummary(stats) {
  if (!stats.duplicateGroupCount) {
    return '<p>No duplicate bookmark URLs were found.</p>'
  }

  return `
    <p>${formatInteger(stats.duplicateBookmarkCount)} bookmarks share URLs in ${formatInteger(
      stats.duplicateGroupCount,
    )} groups. Ranking prefers more tags, cleaner titles, newer additions, then deeper folder placement. ${formatInteger(
      stats.removableDuplicateCount,
    )} lower-ranked copies can be selected for deletion.</p>
  `
}

function renderDuplicates(duplicateGroups, canModifyBookmarks) {
  if (!duplicateGroups.length) {
    return '<p class="empty-state">No duplicate bookmark URLs were found.</p>'
  }

  const deleteNotice = canModifyBookmarks
    ? ''
    : '<p class="manager-note">Bookmark deletion is unavailable in this preview context.</p>'

  return `${deleteNotice}${duplicateGroups.map((group) => renderDuplicateGroup(group, canModifyBookmarks)).join('')}`
}

function renderDuplicateGroup(group, canModifyBookmarks) {
  return `
    <section class="duplicate-group" data-duplicate-group>
      <header class="duplicate-header">
        <div>
          <h3>${escapeHtml(group.displayUrl)}</h3>
          <p>${formatInteger(group.count)} bookmarks with the same normalized URL</p>
        </div>
        <button class="text-button" type="button" data-select-group>Select lower-ranked copies</button>
      </header>
      <ul class="duplicate-bookmarks">
        ${group.bookmarks.map((bookmark) => renderDuplicateBookmark(group, bookmark, canModifyBookmarks)).join('')}
      </ul>
    </section>
  `
}

function renderDuplicateBookmark(group, bookmark, canModifyBookmarks) {
  const bookmarkId = String(bookmark.originalId)
  const isKeep = bookmarkId === group.keepId
  const disabled = canModifyBookmarks ? '' : ' disabled'
  const checked = isKeep ? '' : ' checked'
  const deleteTitle = canModifyBookmarks ? 'Delete this bookmark' : 'Bookmark deletion is unavailable in this context'

  return `
    <li class="duplicate-bookmark${isKeep ? ' keep-bookmark' : ''}">
      <div class="duplicate-details">
        ${renderDuplicateSuggestion(bookmark)}
        <div class="bookmark-title">${renderBookmarkTitle(bookmark)}</div>
        <div class="bookmark-meta">
          ${renderFolderBadge(bookmark.folderArray, 'duplicate-folder')}
          ${renderDateBadge(bookmark.dateAdded)}
          ${renderTagBadges(bookmark.tagsArray)}
        </div>
        <div class="bookmark-url">${escapeHtml(bookmark.originalUrl || bookmark.url)}</div>
      </div>
      <div class="duplicate-row-actions">
        <label class="duplicate-bulk-delete">
          <input type="checkbox" data-delete-bookmark-id="${escapeHtml(bookmarkId)}"${checked}${disabled}>
          <span>Select</span>
        </label>
        <button class="button danger duplicate-delete-button" type="button" data-delete-single-bookmark-id="${escapeHtml(
          bookmarkId,
        )}" title="${escapeHtml(deleteTitle)}"${disabled}>
          ${renderTrashIcon()}
          <span>Delete</span>
        </button>
      </div>
    </li>
  `
}

function renderDuplicateSuggestion(bookmark) {
  const suggestion = bookmark.duplicateSuggestion
  if (!suggestion) {
    return ''
  }

  const suggestionClass = suggestion.recommended ? 'suggestion-best' : 'suggestion-copy'

  return `
    <div class="duplicate-suggestion">
      <span class="badge ${suggestionClass}">${escapeHtml(suggestion.label)}</span>
      <span>${escapeHtml(suggestion.detail)}</span>
    </div>
  `
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
        ${visibleTags.map((tag) => renderTagManagerRow(tag, canUpdateBookmarks, selectedTag)).join('')}
      </ol>
      ${renderTagBookmarkPanel(selectedTag)}
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

function renderTagManagerRow(tag, canUpdateBookmarks, selectedTag) {
  const disabled = canUpdateBookmarks ? '' : ' disabled'
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
      <div class="tag-manager-actions">
        <button class="button secondary tag-rename-button" type="button" data-rename-tag="${safeName}"${disabled}>
          Rename
        </button>
        <button class="button danger tag-remove-button" type="button" data-remove-tag="${safeName}"${disabled}>
          Remove
        </button>
      </div>
    </li>
  `
}

function renderTagBookmarkPanel(tag) {
  const bookmarks = getBookmarksForTag(tag)

  if (!bookmarks.length) {
    return `
      <section class="tag-bookmark-panel">
        <p class="empty-state">No bookmarks use this tag.</p>
      </section>
    `
  }

  return `
    <section class="tag-bookmark-panel">
      <header class="tag-bookmark-panel-header">
        <h3>#${escapeHtml(tag.name)}</h3>
        <p>${formatInteger(bookmarks.length)} ${bookmarks.length === 1 ? 'bookmark' : 'bookmarks'}</p>
      </header>
      <ul class="bookmark-list tag-bookmark-list">
        ${bookmarks.map(renderBookmarkListItem).join('')}
      </ul>
    </section>
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
}

function renderBookmarkTitle(bookmark) {
  const title = bookmark.title || bookmark.originalUrl || bookmark.url
  const url = bookmark.originalUrl || bookmark.url

  if (isSafeLinkUrl(url)) {
    return `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(title)}</a>`
  }

  return escapeHtml(title)
}

function renderFolderBadge(folderArray, extraClass = '') {
  const folder = formatFolder(folderArray)
  return `<span class="badge folder ${extraClass}" title="Bookmark Folder">~${escapeHtml(folder)}</span>`
}

function renderTagBadges(tags = []) {
  if (!tags.length) {
    return ''
  }

  return tags.map((tag) => `<span class="badge tags" title="Bookmark Tags">#${escapeHtml(tag)}</span>`).join('')
}

function renderDateBadge(timestamp) {
  const text = Number.isFinite(timestamp) ? formatDate(timestamp) : 'No date'
  return `<span class="badge date-added" title="Date Added">${escapeHtml(text)}</span>`
}

function renderRecentPagination(currentPage, pageCount, bookmarkCount) {
  if (pageCount <= 1) {
    return ''
  }

  const previousPage = Math.max(1, currentPage - 1)
  const nextPage = Math.min(pageCount, currentPage + 1)
  const start = (currentPage - 1) * RECENT_BOOKMARKS_PER_PAGE + 1
  const end = Math.min(bookmarkCount, currentPage * RECENT_BOOKMARKS_PER_PAGE)

  return `
    <div class="pagination">
      <button class="button" type="button" data-recent-page="${previousPage}"${currentPage === 1 ? ' disabled' : ''}>
        Previous
      </button>
      <span>${formatInteger(start)}-${formatInteger(end)} of ${formatInteger(bookmarkCount)}</span>
      <button class="button" type="button" data-recent-page="${nextPage}"${
        currentPage === pageCount ? ' disabled' : ''
      }>
        Next
      </button>
    </div>
  `
}

function renderRecentBookmarksIntoDom() {
  const bookmarks = ext.model.bookmarkManager?.bookmarks || []
  ext.dom.manager.recentBookmarks.innerHTML = renderRecentBookmarks(bookmarks)
}

function clampRecentPage(page, pageCount) {
  return Math.min(pageCount, Math.max(1, page))
}

function selectSuggestedDuplicates() {
  const groups = document.querySelectorAll('[data-duplicate-group]')
  for (const group of groups) {
    selectSuggestedGroup(group)
  }
  updateDuplicateActions()
}

function clearDuplicateSelection() {
  const inputs = document.querySelectorAll('[data-delete-bookmark-id]')
  for (const input of inputs) {
    input.checked = false
  }
  updateDuplicateActions()
}

function updateDuplicateActions() {
  const dom = ext.dom.manager
  const selectedCount = getSelectedDuplicateIds().length

  dom.deleteSelected.disabled = selectedCount === 0
  dom.deleteSelected.querySelector('[data-selected-count]').textContent = String(selectedCount)
}

function selectSuggestedGroup(group) {
  const rows = group.querySelectorAll('.duplicate-bookmark')
  for (const row of rows) {
    const input = row.querySelector('[data-delete-bookmark-id]')
    if (input && !input.disabled) {
      input.checked = !row.classList.contains('keep-bookmark')
    }
  }
}

function formatInteger(value) {
  return Number(value || 0).toLocaleString('en-US')
}

function formatDecimal(value) {
  return Number(value || 0).toLocaleString('en-US', {
    maximumFractionDigits: 1,
  })
}

function formatDate(timestamp) {
  return DATE_FORMATTER.format(new Date(timestamp))
}

function formatFolder(folderArray) {
  if (!folderArray || folderArray.length === 0) {
    return 'Root'
  }
  return folderArray.join(' / ')
}

function isSafeLinkUrl(url) {
  if (!url) {
    return false
  }

  try {
    const parsedUrl = new URL(url)
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
  } catch (_error) {
    return false
  }
}
