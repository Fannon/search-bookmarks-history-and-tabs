/**
 * @file Coordinates the popup search entry point (`popup/index.html`).
 *
 * Responsibilities:
 * - Initialize the shared extension context and expose it on `window.ext` for debugging.
 * - Load options plus bookmarks, tabs, and history data before wiring up search handlers.
 * - Bind navigation listeners, search input debouncing, and strategy toggles for simple/fuzzy/taxonomy flows.
 * - Maintain hash-based routing (`#search/<term>`) and restore cached results to keep navigation snappy.
 * - Lazy-load mark.js highlighting so first paint stays lightweight while results still highlight matches.
 */

import { loadScript, printError } from './helper/utils.js'
import { getEffectiveOptions } from './model/options.js'
import { getSearchData } from './model/searchData.js'
import { search } from './search/common.js'
import { addDefaultEntries } from './search/common.js'
import { renderSearchResults } from './view/searchView.js'
import { navigationKeyListener } from './view/searchNavigation.js'
import { toggleSearchApproach, updateSearchApproachToggle } from './view/searchEvents.js'
import { createExtensionContext } from './helper/extensionContext.js'

/** Browser extension namespace */
export const ext = createExtensionContext()

window.ext = ext

initExtension().catch((err) => {
  printError(err, 'Could not initialize Extension')
})

/**
 * Initialize the popup search experience and preload datasets.
 *
 * @returns {Promise<void>}
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

  // Debounced search: Clear pending search and schedule new one
  // This prevents executing search algorithm on every keystroke, improving performance
  // during rapid typing. Delay is configurable via searchDebounceMs option.
  let searchTimeout = null
  const debounceMs = ext.opts.searchDebounceMs || 100
  const debouncedSearch = (event) => {
    clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => search(event), debounceMs)
  }
  ext.dom.searchInput.addEventListener('input', debouncedSearch)

  // Cache search results by (term, strategy, mode) to avoid re-running algorithms
  // when user navigates or repeats searches. Cache is simple with no expiration
  // since extension data is immutable during a popup session.
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
 * Handle `window.location.hash` changes and dispatch to the correct view.
 *
 * @returns {Promise<void>}
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
 * Hide the shared error list overlay if it is currently visible.
 */
export function closeErrors() {
  const element = document.getElementById('error-list')
  if (element) element.style = 'display: none;'
}
