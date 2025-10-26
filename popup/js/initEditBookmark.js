/**
 * @file Bootstraps the standalone bookmark editor (`popup/editBookmark.html`).
 *
 * Responsibilities:
 * - Parse bookmark identifiers from hash fragments, supporting both new and legacy formats.
 * - Load options plus bookmark data so editing, deleting, and validation use the same models as the search view.
 * - Wire save/delete/cancel handlers while tracking return hashes to jump back to the originating search state.
 * - Handle hash changes mid-session to reload different bookmarks without refreshing the page.
 */

import { createExtensionContext } from './helper/extensionContext.js'
import { getEffectiveOptions } from './model/options.js'
import { getSearchData } from './model/searchData.js'
import { deleteBookmark, editBookmark, updateBookmark } from './view/editBookmarkView.js'
import { printError } from './view/errorView.js'

export const ext = createExtensionContext()

window.ext = ext

const BOOKMARK_HASH_PREFIX = '#bookmark/'
const LEGACY_BOOKMARK_HASH_PREFIX = '#id/'

/**
 * Bootstrap the standalone bookmark editor page and wire up event handlers.
 *
 * @returns {Promise<void>}
 */
export async function initEditBookmark() {
  const loadingIndicator = document.getElementById('edit-bookmark-loading')

  try {
    ext.dom.editBookmark = document.getElementById('edit-bookmark')
    ext.dom.errorList = document.getElementById('error-list')
    ext.dom.saveButton = document.getElementById('edit-bookmark-save')
    ext.dom.deleteButton = document.getElementById('edit-bookmark-delete')
    ext.dom.cancelButton = document.getElementById('edit-bookmark-cancel')
    ext.dom.searchApproachToggle = document.getElementById('search-approach-toggle')
    ext.opts = await getEffectiveOptions()

    const { bookmarkId, returnHash } = parseBookmarkHash(window.location.hash)
    if (!bookmarkId) {
      throw new Error('Missing bookmark identifier in URL hash.')
    }
    ext.returnHash = normalizeReturnHash(returnHash)

    const { bookmarks } = await getSearchData()
    ext.model.bookmarks = bookmarks

    setupEventHandlers()
    await editBookmark(bookmarkId)

    window.addEventListener('hashchange', handleHashChange)

    ext.initialized = true
  } catch (error) {
    printError(error, 'Could not initialize bookmark editor.')
    if (ext.dom && ext.dom.cancelButton) {
      ext.dom.cancelButton.focus()
    }
  } finally {
    if (loadingIndicator) {
      loadingIndicator.remove()
    }
  }
}

/**
 * Extract bookmark id and return hash from a bookmark editor location hash.
 *
 * @param {string} hash - Raw `window.location.hash` string.
 * @returns {{bookmarkId: string|null, returnHash: string|null}}
 */
function parseBookmarkHash(hash) {
  if (!hash) {
    return { bookmarkId: null, returnHash: null }
  }

  if (hash.startsWith(BOOKMARK_HASH_PREFIX)) {
    const hashBody = hash.slice(BOOKMARK_HASH_PREFIX.length)
    const { bookmarkId, returnHash } = parseBookmarkComponents(hashBody)
    return { bookmarkId, returnHash }
  }

  if (hash.startsWith(LEGACY_BOOKMARK_HASH_PREFIX)) {
    const hashBody = hash.slice(LEGACY_BOOKMARK_HASH_PREFIX.length)
    const { bookmarkId, returnHash } = parseBookmarkComponents(hashBody)
    return { bookmarkId, returnHash }
  }

  return { bookmarkId: null, returnHash: null }
}

/**
 * Parse bookmark id plus optional return hash parameters from a hash body.
 *
 * @param {string} hashBody - Hash contents after the prefix.
 * @returns {{bookmarkId: string, returnHash: string|null}}
 */
function parseBookmarkComponents(hashBody) {
  const delimiterIndex = hashBody.search(/[&?]/)
  const pathPart = delimiterIndex === -1 ? hashBody : hashBody.slice(0, delimiterIndex)
  const paramsString = delimiterIndex === -1 ? '' : hashBody.slice(delimiterIndex + 1)

  let bookmarkIdPart = pathPart
  let derivedReturnHash = null

  const searchSegmentMarker = '/search/'
  const searchSegmentIndex = pathPart.indexOf(searchSegmentMarker)
  if (searchSegmentIndex !== -1) {
    bookmarkIdPart = pathPart.slice(0, searchSegmentIndex)
    const searchTermSegment = pathPart.slice(searchSegmentIndex + searchSegmentMarker.length)
    const decodedSearchTerm = decodeURIComponentSafe(searchTermSegment)
    derivedReturnHash = buildSearchHash(decodedSearchTerm)
  }

  const searchParams = new URLSearchParams(paramsString)
  if (searchParams.has('return')) {
    derivedReturnHash = searchParams.get('return')
  } else if (!derivedReturnHash && searchParams.has('searchTerm')) {
    const decodedSearchTerm = searchParams.get('searchTerm') || ''
    derivedReturnHash = buildSearchHash(decodedSearchTerm)
  }

  return {
    bookmarkId: decodeURIComponent(bookmarkIdPart),
    returnHash: derivedReturnHash,
  }
}

/**
 * Decode URI components while swallowing malformed encodings.
 *
 * @param {string} value - Value to decode.
 * @returns {string} Decoded or original value.
 */
function decodeURIComponentSafe(value) {
  if (!value) {
    return ''
  }
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/**
 * Build a `#search/<term>` hash fragment for redirection.
 *
 * @param {string} searchTerm - Search term to encode.
 * @returns {string} Hash fragment.
 */
function buildSearchHash(searchTerm) {
  if (!searchTerm) {
    return '#search/'
  }
  return `#search/${encodeURIComponent(searchTerm)}`
}

/**
 * Register click handlers for bookmark editor actions.
 */
function setupEventHandlers() {
  const saveButton = document.getElementById('edit-bookmark-save')
  const deleteButton = document.getElementById('edit-bookmark-delete')
  const cancelButton = document.getElementById('edit-bookmark-cancel')

  if (saveButton && !saveButton.dataset.listenerAttached) {
    saveButton.addEventListener('click', (event) => {
      event.preventDefault()
      if (ext.currentBookmarkId) {
        updateBookmark(ext.currentBookmarkId)
      } else {
        window.location.href = getReturnTarget()
      }
    })
    saveButton.dataset.listenerAttached = 'true'
  }

  if (deleteButton && !deleteButton.dataset.listenerAttached) {
    deleteButton.addEventListener('click', async (event) => {
      event.preventDefault()
      if (ext.currentBookmarkId) {
        await deleteBookmark(ext.currentBookmarkId)
      } else {
        window.location.href = getReturnTarget()
      }
    })
    deleteButton.dataset.listenerAttached = 'true'
  }

  if (cancelButton) {
    cancelButton.href = getReturnTarget()
  }
}

/**
 * Respond to hash changes by reloading the requested bookmark.
 *
 * @returns {Promise<void>}
 */
async function handleHashChange() {
  const { bookmarkId, returnHash } = parseBookmarkHash(window.location.hash)
  if (!bookmarkId) {
    return
  }

  ext.returnHash = normalizeReturnHash(returnHash)
  if (ext.dom && ext.dom.cancelButton) {
    ext.dom.cancelButton.href = getReturnTarget()
  }

  if (bookmarkId === ext.currentBookmarkId) {
    return
  }

  try {
    await editBookmark(bookmarkId)
  } catch (error) {
    printError(error, 'Failed to update bookmark editor.')
  }
}

/**
 * Normalize bookmark return hashes to `#search` routes.
 *
 * @param {string} hash - Raw return hash.
 * @returns {string} Sanitized hash.
 */
function normalizeReturnHash(hash) {
  if (!hash) {
    return '#search/'
  }

  if (hash.startsWith('#search')) {
    return hash
  }

  return '#search/'
}

/**
 * Resolve the URL to navigate back to the search view.
 *
 * @returns {string} Target URL.
 */
function getReturnTarget() {
  const returnHash = normalizeReturnHash(ext.returnHash)
  return `./index.html${returnHash}`
}

initEditBookmark().catch((error) => {
  printError(error, 'Failed to load bookmark editor.')
})
