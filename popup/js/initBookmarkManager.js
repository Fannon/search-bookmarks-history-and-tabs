/**
 * @file Coordinates the dedicated bookmark manager page.
 */

import { createExtensionContext } from './helper/extensionContext.js'
import { createBookmarkManagerModel } from './model/bookmarkManagerData.js'
import { getEffectiveOptions } from './model/options.js'
import { getSearchData } from './model/searchData.js'
import {
  bindBookmarkManagerEvents,
  getBookmarkManagerDom,
  getSelectedDuplicateIds,
  renderBookmarkManager,
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

  // Keep manager loading focused on bookmarks. Tabs and history stay popup-only here.
  ext.opts.enableTabs = false
  ext.opts.enableHistory = false
  ext.opts.enableBookmarks = true
  ext.opts.detectDuplicateBookmarks = false
  ext.opts.bookmarksIgnoreFolderList = []
  applyManagerColors()

  bindBookmarkManagerEvents({
    onRefresh: reloadBookmarkManager,
    onDeleteSelected: deleteSelectedDuplicates,
    onDeleteOne: deleteSingleDuplicate,
    onRenameTag: renameTag,
    onRemoveTag: removeTag,
  })

  await reloadBookmarkManager()
  ext.initialized = true
}

/**
 * Reload bookmark data and rerender the manager.
 */
export async function reloadBookmarkManager() {
  try {
    showManagerStatus('Loading bookmarks...')
    const { bookmarks } = await getSearchData()
    ext.model.bookmarks = bookmarks
    ext.model.bookmarkManager = createBookmarkManagerModel(bookmarks)

    renderBookmarkManager(ext.model.bookmarkManager, canModifyBookmarks(), canUpdateBookmarks())
    showManagerStatus('Loaded')
  } catch (error) {
    showManagerStatus('Load failed', 'error')
    printError(error, 'Could not load bookmark manager data.')
  } finally {
    ext.dom.manager.loadingIndicator?.remove()
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
