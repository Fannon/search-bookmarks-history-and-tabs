/**
 * @file Coordinates the popup search entry point (`popup/index.html`).
 *
 * Responsibilities:
 * - Initialize the shared extension context and expose it on `window.ext` for debugging.
 * - Load options plus bookmarks, tabs, and history data before wiring up search handlers.
 * - Bind navigation listeners, search input handling, and strategy toggles for simple/fuzzy/taxonomy flows.
 * - Maintain hash-based routing (`#search/<term>`) and restore cached results to keep navigation snappy.
 */

import { createExtensionContext } from './helper/extensionContext.js'
import { getEffectiveOptions } from './model/options.js'
import { getSearchData } from './model/searchData.js'

import { addDefaultEntries, search } from './search/common.js'

import { closeErrors, printError } from './view/errorView.js'
import { toggleSearchApproach, updateSearchApproachToggle } from './view/searchEvents.js'
import { navigationKeyListener } from './view/searchNavigation.js'
import { renderSearchResults } from './view/searchView.js'

export { closeErrors } from './view/errorView.js'

/** Browser extension namespace */
export const ext = createExtensionContext()

window.ext = ext
// Expose error helpers for e2e testing
window.ext.printError = printError
window.ext.closeErrors = closeErrors

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

  ext.dom.searchInput = document.getElementById('q')
  ext.dom.resultList = document.getElementById('results')
  ext.dom.resultCounter = document.getElementById('counter')
  ext.dom.searchApproachToggle = document.getElementById('toggle')

  updateSearchApproachToggle()

  // Load bookmarks, tabs, and history data for searching
  Object.assign(ext.model, await getSearchData())

  // Register Events
  document.addEventListener('keydown', navigationKeyListener)
  window.addEventListener('hashchange', hashRouter, false)
  ext.dom.searchApproachToggle.addEventListener('mouseup', toggleSearchApproach)

  // Run a search on every input event instead of debouncing. The popup dataset is small
  // enough that the simpler approach keeps navigation in sync with what the user sees,
  // avoiding stale selections when Enter is pressed quickly after typing.
  ext.dom.searchInput.addEventListener('input', search)

  // Cache search results by (term, strategy, mode) to avoid re-running algorithms
  ext.searchCache = new Map()
  // Track successfully loaded favicon URLs to prevent fade-in on re-renders
  ext.model.loadedFavicons = new Set()

  ext.initialized = true

  hashRouter()

  if (document.getElementById('results-load')) {
    document.getElementById('results-load').remove()
  }

  console.debug(`Init in ${Date.now() - startTime}ms`)
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
    hash = `#search/${ext.dom.searchInput.value}`
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
