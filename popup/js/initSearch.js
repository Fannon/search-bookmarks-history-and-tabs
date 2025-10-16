import { loadScript, printError } from './helper/utils.js'
import { getEffectiveOptions } from './model/options.js'
import { getSearchData } from './model/searchData.js'
import { search } from './search/common.js'
import { addDefaultEntries } from './search/common.js'
import { editBookmark, updateBookmark } from './view/editBookmarkView.js'
import {
  navigationKeyListener,
  renderSearchResults,
  toggleSearchApproach,
  updateSearchApproachToggle,
} from './view/searchView.js'
import { createExtensionContext } from './helper/extensionContext.js'

//////////////////////////////////////////
// EXTENSION NAMESPACE                  //
//////////////////////////////////////////

/** Browser extension namespace */
export const ext = createExtensionContext()

window.ext = ext

//////////////////////////////////////////
// INITIALIZE EXTENSION                 //
//////////////////////////////////////////

// Trigger initialization
ext.initialized = false
initExtension().catch((err) => {
  printError(err, 'Could not initialize Extension')
})

/**
 * Initialize the extension
 * This includes indexing the current bookmarks and history
 */
export async function initExtension() {
  const startTime = Date.now()

  // Load effective options, including user customizations
  ext.opts = await getEffectiveOptions()

  // HTML Element selectors
  ext.dom.searchInput = document.getElementById('search-input')
  ext.dom.resultList = document.getElementById('result-list')
  ext.dom.resultCounter = document.getElementById('result-counter')
  ext.dom.searchApproachToggle = document.getElementById('search-approach-toggle')

  updateSearchApproachToggle()

  const { bookmarks, tabs, history } = await getSearchData()
  ext.model.tabs = tabs
  ext.model.bookmarks = bookmarks
  ext.model.history = history

  ext.initialized = true

  // Register Events
  document.addEventListener('keydown', navigationKeyListener)
  window.addEventListener('hashchange', hashRouter, false)
  ext.dom.searchApproachToggle.addEventListener('mouseup', toggleSearchApproach)

  // Add debounced search to prevent excessive calls on rapid typing
  let searchTimeout = null
  const debounceMs = ext.opts.searchDebounceMs || 100
  const debouncedSearch = (event) => {
    clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => search(event), debounceMs)
  }
  ext.dom.searchInput.addEventListener('input', debouncedSearch)

  // Add search result cache for better performance (simple, no expiration needed)
  ext.searchCache = new Map()

  // Display default entries
  await addDefaultEntries()
  renderSearchResults(ext.model.result)

  if (window.location.hash && window.location.hash !== '/') {
    hashRouter()
  }

  if (document.getElementById('results-loading')) {
    document.getElementById('results-loading').remove()
  }

  // Only trigger final search if user has entered a search term
  // This prevents overriding the default entries with a duplicate call
  if (ext.dom.searchInput.value && ext.dom.searchInput.value.trim()) {
    search()
  }

  // Lazy load mark.js for highlighting search results after init phase
  await loadScript('./lib/mark.es6.min.js')

  console.debug('Extension initialized in ' + (Date.now() - startTime) + 'ms')
}

//////////////////////////////////////////
// GENERAL NAVIGATION                   //
//////////////////////////////////////////

/**
 * URL Hash Router
 */
export async function hashRouter() {
  try {
    const hash = window.location.hash
    closeModals()
    if (!hash || hash === '#') {
      // Index route -> redirect to last known search or empty search
      window.location.hash = '#search/'
    } else if (hash.startsWith('#search/')) {
      // Search specific term
      const searchTerm = hash.replace('#search/', '')
      if (searchTerm) {
        ext.dom.searchInput.value = decodeURIComponent(searchTerm)
      }
      ext.dom.searchInput.focus()
      search()
    } else if (hash.startsWith('#tags/')) {
      window.location.replace(`./tags.html${hash}`)
    } else if (hash.startsWith('#folders/')) {
      window.location.replace(`./folders.html${hash}`)
    } else if (hash.startsWith('#edit-bookmark/')) {
      // Edit bookmark route
      const bookmarkId = hash.replace('#edit-bookmark/', '')
      void editBookmark(bookmarkId)
    } else if (hash.startsWith('#update-bookmark/')) {
      // Update bookmark route
      const bookmarkId = hash.replace('#update-bookmark/', '')
      updateBookmark(bookmarkId)
    }
  } catch (err) {
    printError(err)
  }
}

/**
 * Close all modal overlays
 */
export function closeModals() {
  const modals = ['edit-bookmark', 'tags-overview', 'folders-overview', 'error-list']
  modals.forEach((id) => {
    const element = document.getElementById(id)
    if (element) element.style = 'display: none;'
  })
}
