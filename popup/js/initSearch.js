import { printError } from './helper/utils.js'
import { extensionNamespace as ext } from './model/namespace.js'
import { getEffectiveOptions } from './model/options.js'
import { getSearchData } from './model/searchData.js'
import { search } from './search/common.js'
import { editBookmark, updateBookmark } from './view/editBookmarkView.js'
import { loadFoldersOverview } from './view/foldersView.js'
import { navigationKeyListener, toggleSearchApproach, updateSearchApproachToggle } from './view/searchView.js'
import { loadTagsOverview } from './view/tagsView.js'

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
  if (ext.opts.debug) {
    performance.mark('init-start')
  }

  // Load effective options, including user customizations
  ext.opts = await getEffectiveOptions()
  if (ext.opts.debug) {
    console.debug('Initialized with options', ext.opts)
  }

  // HTML Element selectors
  ext.dom.searchInput = document.getElementById('search-input')
  ext.dom.resultList = document.getElementById('result-list')
  ext.dom.resultCounter = document.getElementById('result-counter')
  ext.dom.searchApproachToggle = document.getElementById('search-approach-toggle')

  updateSearchApproachToggle()

  if (ext.opts.debug) {
    performance.mark('init-dom')
  }

  const { bookmarks, tabs, history } = await getSearchData()
  ext.model.tabs = tabs
  ext.model.bookmarks = bookmarks
  ext.model.history = history

  if (ext.opts.debug) {
    performance.mark('init-data-load')
  }
  ext.initialized = true

  // Register Events
  document.addEventListener('keydown', navigationKeyListener)
  window.addEventListener('hashchange', hashRouter, false)
  ext.dom.searchApproachToggle.addEventListener('mouseup', toggleSearchApproach)
  ext.dom.searchInput.addEventListener('keyup', search)

  if (ext.opts.debug) {
    performance.mark('init-router')
  }
  if (!document.querySelector('#result-list .message')) {
    // Initialize the router by executing it for the first time
    // Only do this if there are no (error / warning) messages displayed
    hashRouter()
  }

  if (ext.opts.debug) {
    // Do some performance measurements and log it to debug
    performance.mark('init-end')
    performance.measure('init-end-to-end', 'init-start', 'init-end')
    performance.measure('init-dom', 'init-start', 'init-dom')
    performance.measure('init-data-load', 'init-dom', 'init-data-load')
    performance.measure('init-router', 'init-data-load', 'init-router')
    const initPerformance = performance.getEntriesByType('measure')
    const totalInitPerformance = performance.getEntriesByName('init-end-to-end')
    console.debug('Init Performance: ' + totalInitPerformance[0].duration + 'ms', initPerformance)
    performance.clearMeasures()
  }

  if (document.getElementById('results-loading')) {
    document.getElementById('results-loading').remove()
  }
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
      loadTagsOverview()
    } else if (hash.startsWith('#folders/')) {
      loadFoldersOverview()
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
  document.getElementById('edit-bookmark').style = 'display: none;'
  document.getElementById('tags-overview').style = 'display: none;'
  document.getElementById('folders-overview').style = 'display: none;'
  document.getElementById('error-list').style = 'display: none;'
}
