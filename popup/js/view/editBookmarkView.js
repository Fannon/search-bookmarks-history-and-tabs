/**
 * @file Drives the bookmark editor interactions and form logic.
 *
 * Responsibilities:
 * - Load bookmark data for editing and initialize Tagify-powered tag autocompletion.
 * - Validate user input, persist updates through the browser API, and surface inline errors.
 * - Handle delete/cancel flows plus bonus-score parsing while keeping the UI responsive.
 * - Invalidate search caches and taxonomy indexes so edits reflect immediately in the popup search view.
 */

import { browserApi, createSearchString } from '../helper/browserApi.js'
import { cleanUpUrl } from '../helper/utils.js'
import { resetFuzzySearchState } from '../search/fuzzySearch.js'
import { resetSimpleSearchState } from '../search/simpleSearch.js'
import { getUniqueTags, resetUniqueFoldersCache } from '../search/taxonomySearch.js'

/**
 * Populate the bookmark editor form for the given bookmark id.
 *
 * @param {string} bookmarkId - Identifier of the bookmark to edit.
 * @returns {Promise<void>}
 */
export async function editBookmark(bookmarkId) {
  const bookmark = ext.model.bookmarks.find((el) => el.originalId === bookmarkId)
  const uniqueTags = getUniqueTags() || {}
  const tags = Object.keys(uniqueTags).sort()
  const editContainer = document.getElementById('edit-bookmark')
  const titleInput = document.getElementById('bookmark-title')
  const urlInput = document.getElementById('bookmark-url')
  const tagsInput = document.getElementById('bookmark-tags')
  const saveButton = document.getElementById('edit-bookmark-save')
  const deleteButton = document.getElementById('edit-bookmark-delete')

  if (bookmark) {
    editContainer.style = ''
    titleInput.value = bookmark.title
    urlInput.value = bookmark.originalUrl
    if (!ext.tagify) {
      ext.tagify = new Tagify(tagsInput, {
        whitelist: tags,
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
    } else {
      // If tagify was already initialized:
      // reset current and available tags to new state
      ext.tagify.removeAllTags()
      ext.tagify.whitelist = tags
    }

    const currentTags = bookmark.tags
      .split('#')
      .map((el) => el.trim())
      .filter((el) => el)
    ext.tagify.addTags(currentTags)

    saveButton.dataset.bookmarkId = bookmarkId
    deleteButton.dataset.bookmarkId = bookmarkId
    ext.currentBookmarkId = bookmarkId
  } else {
    console.warn(`Tried to edit bookmark id="${bookmarkId}", but could not find it in searchData.`)
  }

  function transformTag(tagData) {
    if (tagData.value.includes('#')) {
      tagData.value = tagData.value.split('#').join('')
    }
  }
}

/**
 * Apply form changes to the data model and browser bookmarks API.
 *
 * @param {string} bookmarkId - Identifier of the bookmark being updated.
 */
export function updateBookmark(bookmarkId) {
  const bookmark = ext.model.bookmarks.find((el) => el.originalId === bookmarkId)
  const titleInput = document.getElementById('bookmark-title').value.trim()
  const urlInput = document.getElementById('bookmark-url').value.trim()
  let tagsInput = ''
  if (ext.tagify.value.length) {
    tagsInput = '#' + ext.tagify.value.map((el) => el.value.trim()).join(' #')
  }

  // Update search data model of bookmark
  bookmark.title = titleInput
  bookmark.originalUrl = urlInput
  bookmark.url = cleanUpUrl(urlInput)
  bookmark.tags = tagsInput
  bookmark.searchString = createSearchString(bookmark.title, bookmark.url, bookmark.tags, bookmark.folder)
  bookmark.searchStringLower = bookmark.searchString.toLowerCase()
  resetFuzzySearchState('bookmarks')
  resetSimpleSearchState('bookmarks')
  resetUniqueFoldersCache()

  if (browserApi.bookmarks) {
    browserApi.bookmarks.update(bookmarkId, {
      title: `${titleInput} ${tagsInput}`,
      url: urlInput,
    })
  } else {
    console.warn(`No browser bookmarks API found. Bookmark update will not persist.`)
  }

  // Start search again to update the search index and the UI with new bookmark model
  navigateToSearchView()
}

/**
 * Remove a bookmark via the browser API and refresh search caches.
 *
 * @param {string} bookmarkId - Identifier of the bookmark to delete.
 * @returns {Promise<void>}
 */
export async function deleteBookmark(bookmarkId) {
  if (browserApi.bookmarks) {
    browserApi.bookmarks.remove(bookmarkId)
  } else {
    console.warn(`No browser bookmarks API found. Bookmark remove will not persist.`)
  }

  // Remove item from search data and reset search caches
  ext.model.bookmarks = ext.model.bookmarks.filter((el) => {
    return el.originalId !== bookmarkId
  })
  resetFuzzySearchState('bookmarks')
  resetSimpleSearchState('bookmarks')
  resetUniqueFoldersCache()

  navigateToSearchView()
}

/**
 * Navigate back to the search view, preserving return hashes when possible.
 */
function navigateToSearchView() {
  const redirectHash =
    ext && typeof ext.returnHash === 'string' && ext.returnHash.startsWith('#search') ? ext.returnHash : '#search/'
  const redirectTarget = `./index.html${redirectHash}`
  let resolvedTarget = redirectTarget
  try {
    resolvedTarget = new URL(redirectTarget, window.location.href).toString()
  } catch {
    resolvedTarget = redirectTarget
  }
  try {
    if (typeof window.location.assign === 'function') {
      window.location.assign(resolvedTarget)
    } else {
      window.location.href = resolvedTarget
    }
  } catch (navigationError) {
    console.warn('Navigation to search view not supported in this environment.', navigationError)
    if (window.history && window.history.replaceState) {
      try {
        window.history.replaceState(null, '', resolvedTarget)
      } catch (historyError) {
        console.warn('Failed to update history state for search view navigation.', historyError)
      }
    }
  }
}
