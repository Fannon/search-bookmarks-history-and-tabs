/**
 * @file Coordinates the popup search entry point (`popup/index.html`).
 *
 * Responsibilities:
 * - Initialize the shared extension context and expose it on `window.ext` for debugging.
 * - Load options plus bookmarks, tabs, and history data before wiring up search handlers.
 * - Bind navigation listeners, search input handling, and strategy toggles for simple/fuzzy/taxonomy flows.
 * - Maintain hash-based routing (`#search/<term>`) and restore cached results to keep navigation snappy.
 * - Lazy-load mark.js highlighting so first paint stays lightweight while results still highlight matches.
 */

import { loadScript } from './helper/utils.js'
import { getEffectiveOptions } from './model/options.js'
import { getSearchData } from './model/searchData.js'
import { search } from './search/common.js'
import { addDefaultEntries } from './search/common.js'
import { renderSearchResults } from './view/searchView.js'
import { navigationKeyListener } from './view/searchNavigation.js'
import { toggleSearchApproach, updateSearchApproachToggle } from './view/searchEvents.js'
import { createExtensionContext } from './helper/extensionContext.js'
import { closeErrors, printError } from './view/errorView.js'

export { closeErrors } from './view/errorView.js'

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

  // Run a search on every input event instead of debouncing. The popup dataset is small
  // enough that the simpler approach keeps navigation in sync with what the user sees,
  // avoiding stale selections when Enter is pressed quickly after typing.
  ext.dom.searchInput.addEventListener('input', search)

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
      ext.model.result = await addDefaultEntries()
      renderSearchResults()
    }
  }
}
