import { loadScript, printError } from './helper/utils.js'
import { getEffectiveOptions } from './model/options.js'
import { getSearchData } from './model/searchData.js'
import { search } from './search/common.js'
import { addDefaultEntries } from './search/common.js'
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

  ext.initialized = true

  hashRouter()

  if (document.getElementById('results-loading')) {
    document.getElementById('results-loading').remove()
  }

  console.debug('Extension initialized in ' + (Date.now() - startTime) + 'ms')

  // Lazy load mark.js for highlighting search results after init phase
  await loadScript('./lib/mark.es6.min.js')
}

//////////////////////////////////////////
// GENERAL NAVIGATION                   //
//////////////////////////////////////////

/**
 * URL Hash Router
 */
export async function hashRouter() {
  let hash = window.location.hash
  if (!hash || hash === '#' || hash === '#/') {
    hash = '#search/' + ext.dom.searchInput.value
  }
  closeErrors()
  if (hash.startsWith('#search/')) {
    // Search specific term
    const searchTerm = decodeURIComponent(hash.replace('#search/', ''))
    if (searchTerm) {
      ext.dom.searchInput.value = searchTerm
      ext.dom.searchInput.focus()
      search()
    } else {
      // Empty search term, show default entries
      ext.dom.searchInput.value = ''
      ext.dom.searchInput.focus()
      // Display default entries
      await addDefaultEntries()
      renderSearchResults(ext.model.result)
    }
  }
}

/**
 * Close all modal overlays
 */
export function closeErrors() {
  const element = document.getElementById('error-list')
  if (element) element.style = 'display: none;'
}
