/**
 * @file Coordinates the popup search entry point (`popup/index.html`).
 *
 * Responsibilities:
 * - Initialize the shared extension context and expose it on `window.ext` for debugging.
 * - Load options plus bookmarks and tabs before wiring up search handlers; merge history once it arrives.
 * - Bind navigation listeners, search input handling, and strategy toggles for simple/fuzzy/taxonomy flows.
 * - Maintain hash-based routing (`#search/<term>`) and restore cached results to keep navigation snappy.
 */

import { createExtensionContext } from './helper/extensionContext.js'
import { getEffectiveOptions } from './model/optionsStorage.js'
import { addSearchHistory, getSearchData, getSearchHistory } from './model/searchData.js'

import { search } from './search/common.js'

import { closeErrors, printError } from './view/errorView.js'
import { toggleSearchApproach, updateSearchApproachToggle } from './view/searchEvents.js'
import { navigationKeyListener } from './view/searchNavigation.js'

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
  let history
  let pendingHistory
  try {
    // Load effective options, including user customizations
    ext.opts = await getEffectiveOptions()

    // HTML Element selectors

    ext.dom.searchInput = document.getElementById('q')
    ext.dom.resultList = document.getElementById('results')
    ext.dom.resultCounter = document.getElementById('counter')
    ext.dom.searchApproachToggle = document.getElementById('toggle')

    updateSearchApproachToggle()

    // Load history in parallel, but don't let it delay the first render: with large histories,
    // `history.search` is by far the slowest browser API. If it arrives with the other data,
    // merge it right away so the popup renders only once.
    const historyRequest = getSearchHistory().then(
      (items) => {
        history = items
      },
      (err) => {
        console.warn('Could not load browser history', err)
        history = []
      },
    )

    // Load bookmarks and tabs data for searching
    Object.assign(ext.model, await getSearchData({ includeHistory: false }))
    if (!history) {
      // With default history limits, the history response is usually already queued behind
      // the bookmark tree. Yield once so it can be merged before the first render.
      await new Promise((resolveTask) => setTimeout(resolveTask))
    }
    if (history) {
      addSearchHistory(ext.model, history)
    } else {
      pendingHistory = historyRequest
    }

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

    await hashRouter()
    ext.initialized = true
  } finally {
    document.getElementById('results-load')?.remove()
  }

  if (pendingHistory) {
    await pendingHistory
    addSearchHistory(ext.model, history)
    ext.searchCache.clear()
    // Refresh the visible search or default results with history included. Skip this if the
    // user already moved the selection, so the list doesn't change under them; their next
    // input includes history anyway.
    if (!ext.model.currentItem) {
      await search({ bypassInitializedGuard: true })
    }
  }
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
    ext.dom.searchInput.value = searchTerm
    ext.dom.searchInput.focus()
    await search({ bypassInitializedGuard: true })
  }
}
