import { printError } from './helper/utils.js'
import { getEffectiveOptions } from './model/options.js'
import { getSearchData } from './model/searchData.js'
import { deleteBookmark, editBookmark, updateBookmark } from './view/editBookmarkView.js'
import { createExtensionContext } from './helper/extensionContext.js'

export const ext = createExtensionContext()

window.ext = ext

const BOOKMARK_HASH_PREFIX = '#bookmark/'

export async function initEditBookmark() {
  const loadingIndicator = document.getElementById('edit-bookmark-loading')

  try {
    ext.dom.editBookmark = document.getElementById('edit-bookmark')
    ext.dom.errorList = document.getElementById('error-list')
    ext.dom.saveButton = document.getElementById('edit-bookmark-save')
    ext.dom.deleteButton = document.getElementById('edit-bookmark-delete')
    ext.dom.cancelButton = document.getElementById('edit-bookmark-cancel')

    const { bookmarkId, returnHash } = parseBookmarkHash(window.location.hash)
    if (!bookmarkId) {
      throw new Error('Missing bookmark identifier in URL hash.')
    }
    ext.returnHash = normalizeReturnHash(returnHash)

    ext.opts = await getEffectiveOptions()
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

function parseBookmarkHash(hash) {
  if (!hash || !hash.startsWith(BOOKMARK_HASH_PREFIX)) {
    return { bookmarkId: null, returnHash: null }
  }

  const hashBody = hash.slice(BOOKMARK_HASH_PREFIX.length)
  const [idPart, queryString = ''] = hashBody.split('?')
  const searchParams = new URLSearchParams(queryString)
  const returnHash = searchParams.get('return')

  return {
    bookmarkId: decodeURIComponent(idPart),
    returnHash,
  }
}

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

function normalizeReturnHash(hash) {
  if (!hash) {
    return '#search/'
  }

  if (hash.startsWith('#search')) {
    return hash
  }

  return '#search/'
}

function getReturnTarget() {
  const returnHash = normalizeReturnHash(ext.returnHash)
  return `./index.html${returnHash}`
}

initEditBookmark().catch((error) => {
  printError(error, 'Failed to load bookmark editor.')
})
