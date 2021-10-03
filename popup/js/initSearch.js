import { extensionNamespace } from './model/namespace.js'
import { getEffectiveOptions } from './model/options.js'
import { getSearchData } from './model/searchData.js'
import { createSearchIndexes, search } from './search/common.js'
import { editBookmark, updateBookmark } from './view/editBookmarkView.js'
import { loadFoldersOverview } from './view/foldersView.js'
import { navigationKeyListener, toggleSearchApproach, updateSearchApproachToggle } from './view/searchView.js'
import { loadTagsOverview } from './view/tagsView.js'

const ext = extensionNamespace
window.ext = ext

//////////////////////////////////////////
// INITIALIZE EXTENSION                 //
//////////////////////////////////////////

// Trigger initialization
extensionNamespace.initialized = false
initExtension().catch((err) => {
  console.error(err)
  document.getElementById('footer-error').innerText = err.message
})

/**
 * Initialize the extension
 * This includes indexing the current bookmarks and history
 */
export async function initExtension() {
  performance.mark('init-start')

  // Load effective options, including user customizations
  extensionNamespace.opts = await getEffectiveOptions()
  console.debug('Initialized with options', extensionNamespace.opts)

  // HTML Element selectors
  extensionNamespace.dom.searchInput = document.getElementById('search-input')
  extensionNamespace.dom.resultList = document.getElementById('result-list')
  extensionNamespace.dom.resultCounter = document.getElementById('result-counter')
  extensionNamespace.dom.searchApproachToggle = document.getElementById('search-approach-toggle')

  updateSearchApproachToggle()

  performance.mark('init-dom')

  const { bookmarks, tabs, history } = await getSearchData()
  extensionNamespace.model.tabs = tabs
  extensionNamespace.model.bookmarks = bookmarks
  extensionNamespace.model.history = history

  performance.mark('init-data-load')

  createSearchIndexes()

  extensionNamespace.initialized = true

  performance.mark('init-search-index')

  // Register Events
  document.addEventListener('keydown', navigationKeyListener)
  window.addEventListener('hashchange', hashRouter, false)
  extensionNamespace.dom.searchApproachToggle.addEventListener('mouseup', toggleSearchApproach)
  extensionNamespace.dom.searchInput.addEventListener('keyup', search)

  // Initialize the router by executing it for the first time
  hashRouter()
  performance.mark('init-router')

  // Do some performance measurements and log it to debug
  performance.mark('init-end')
  performance.measure('init-end-to-end', 'init-start', 'init-end')
  performance.measure('init-dom', 'init-start', 'init-dom')
  performance.measure('init-data-load', 'init-dom', 'init-data-load')
  performance.measure('init-search-index', 'init-data-load', 'init-search-index')
  performance.measure('init-router', 'init-search-index', 'init-router')
  const initPerformance = performance.getEntriesByType('measure')
  const totalInitPerformance = performance.getEntriesByName('init-end-to-end')
  console.debug('Init Performance: ' + totalInitPerformance[0].duration + 'ms', initPerformance)
  performance.clearMeasures()
}

//////////////////////////////////////////
// GENERAL NAVIGATION                   //
//////////////////////////////////////////

/**
 * URL Hash Router
 */
export function hashRouter() {
  const hash = window.location.hash
  console.debug('Changing Route: ' + hash)
  closeModals()
  if (!hash || hash === '#') {
    // Index route -> redirect to last known search or empty search
    window.location.hash = '#search/'
  } else if (hash.startsWith('#search/')) {
    // Search specific term
    const searchTerm = hash.replace('#search/', '')
    if (searchTerm) {
      extensionNamespace.dom.searchInput.value = decodeURIComponent(searchTerm)
    }
    extensionNamespace.dom.searchInput.focus()
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
}

/**
 * Close all modal overlays
 */
export function closeModals() {
  document.getElementById('edit-bookmark').style = 'display: none;'
  document.getElementById('tags-overview').style = 'display: none;'
  document.getElementById('folders-overview').style = 'display: none;'
  document.getElementById('footer-error').innerText = ''
}
