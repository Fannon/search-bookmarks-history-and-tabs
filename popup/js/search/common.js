/**
 * @file Coordinates popup search orchestration and routing.
 *
 * Responsibilities:
 * - Orchestrate the overall search flow from user input to rendered results.
 * - Route to the appropriate search strategy (simple, fuzzy, taxonomy) based on parsed intent.
 * - Handle caching, scoring, sorting, and result filtering.
 * - Coordinate between query parsing, search execution, and rendering.
 *
 * Search flow:
 * 1. Clean the search term and check cache.
 * 2. Parse query to detect mode prefixes and taxonomy markers.
 * 3. Execute appropriate search algorithm (precise, fuzzy, or taxonomy).
 * 4. Apply scoring and sorting to rank results.
 * 5. Filter by minimum score and max results.
 * 6. Render results via view layer.
 *
 * Zero-DOM Highlighting:
 * - Highlights are computed after ranking and truncating results for performance.
 * - Each result includes `highlightedTitle` and `highlightedUrl` with inline `<mark>` tags.
 * - The view layer (searchView.js) renders these pre-computed highlights directly.
 * - This eliminates the need for mark.js and secondary DOM traversals after rendering.
 * - See `highlightResults()` for the implementation.
 */

import { cleanUpUrl, escapeHtml, escapeRegex, generateRandomId, highlightMatches } from '../helper/utils.js'
import { closeErrors, printError } from '../view/errorView.js'
import { renderSearchResults } from '../view/searchView.js'
import { addDefaultEntries } from './defaultResults.js'
import { fuzzySearch } from './fuzzySearch.js'
import { resolveSearchMode } from './queryParser.js'
import { calculateFinalScore } from './scoring.js'
import { addSearchEngines, collectCustomSearchAliasResults } from './searchEngines.js'
import { simpleSearch } from './simpleSearch.js'
import { searchTaxonomy } from './taxonomySearch.js'

// Re-export scoring function for backward compatibility
export { calculateFinalScore }

const urlRegex = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/
const protocolRegex = /^[a-zA-Z]+:\/\//

/**
 * Maps search mode prefixes to their data sources.
 * Used to determine which datasets (bookmarks, tabs, history) to query.
 */
const MODE_TARGETS = {
  history: ['tabs', 'history'],
  bookmarks: ['bookmarks'],
  tabs: ['tabs'],
  search: [],
  all: ['bookmarks', 'tabs', 'history'],
}

/**
 * Resolve the set of data collections associated with a search mode.
 *
 * @param {string} searchMode - Active search mode (e.g. `bookmarks`, `tabs`).
 * @returns {Array<string>} Collection keys to inspect within `ext.model`.
 */
export function resolveSearchTargets(searchMode) {
  return MODE_TARGETS[searchMode] || MODE_TARGETS.all
}

/**
 * Check if the search should be skipped based on the event.
 *
 * @param {KeyboardEvent|InputEvent} [event] - Optional input event.
 * @returns {boolean} True if search should be skipped.
 */
function shouldSkipSearch(event) {
  if (!event) return false

  // Don't execute search on navigation keys
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'Enter' || event.key === 'Escape') {
    return true
  }
  // Don't execute search on modifier keys
  if (event.key === 'Control' || event.ctrlKey || event.key === 'Alt' || event.altKey || event.key === 'Shift') {
    return true
  }

  return false
}

/**
 * Normalize the search term by trimming and removing duplicate spaces.
 *
 * @param {string} term - Raw search term.
 * @returns {string} Normalized term.
 */
function normalizeSearchTerm(term) {
  let normalized = term || ''
  normalized = normalized.trimStart().toLowerCase()
  normalized = normalized.replace(/ +(?= )/g, '') // Remove duplicate spaces
  return normalized
}

/**
 * Check if the search term is cached and render cached results if available.
 *
 * @param {string} searchTerm - The search term to check.
 * @returns {boolean} True if cached results were used.
 */
function useCachedResultsIfAvailable(searchTerm) {
  if (!searchTerm.trim() || !ext.searchCache) {
    return false
  }

  const cacheKey = `${searchTerm}_${ext.opts.searchStrategy}_${ext.model.searchMode || 'all'}`
  if (ext.searchCache.has(cacheKey)) {
    ext.model.searchTerm = searchTerm
    ext.model.result = ext.searchCache.get(cacheKey)
    renderSearchResults()
    return true
  }

  return false
}

/**
 * Render default results when no search term is provided.
 *
 * @returns {Promise<void>}
 */
async function handleEmptySearch() {
  ext.model.searchTerm = '' // Clear search term for default results
  ext.model.result = await addDefaultEntries()
  renderSearchResults()
}

/**
 * Execute the configured search algorithm and return results.
 *
 * @param {string} searchTerm - Query string.
 * @param {string} searchMode - Active search mode.
 * @returns {Promise<Array>} Search results.
 */
export async function executeSearch(searchTerm, searchMode, data, options) {
  const results = []

  if (searchMode === 'tags') {
    return searchTaxonomy(searchTerm, 'tags', data.bookmarks)
  } else if (searchMode === 'folders') {
    return searchTaxonomy(searchTerm, 'folder', data.bookmarks)
  } else if (options.searchStrategy === 'fuzzy') {
    results.push(...(await searchWithAlgorithm('fuzzy', searchTerm, searchMode, data, options)))
  } else if (options.searchStrategy === 'precise') {
    results.push(...(await searchWithAlgorithm('precise', searchTerm, searchMode, data, options)))
  } else {
    console.error(`Unsupported option "search.approach" value: "${options.searchStrategy}"`)
    // Fall back to use precise search instead of crashing entirely
    results.push(...(await searchWithAlgorithm('precise', searchTerm, searchMode, data, options)))
  }

  return results
}

/**
 * Add direct URL result if the search term looks like a URL.
 *
 * @param {string} searchTerm - Query string.
 * @param {Array} results - Current result array.
 */
function addDirectUrlIfApplicable(searchTerm, results) {
  if (ext.opts.enableDirectUrl && urlRegex.test(searchTerm) && results.length < ext.opts.searchMaxResults) {
    const url = protocolRegex.test(searchTerm) ? searchTerm : `https://${searchTerm.replace(/^\/+/, '')}`
    results.push({
      type: 'direct',
      title: `Direct: "${cleanUpUrl(url)}"`,
      url: cleanUpUrl(url),
      originalUrl: url,
      originalId: generateRandomId(),
      searchScore: 1,
    })
  }
}

/**
 * Apply scoring and sorting to search results.
 *
 * @param {Array} results - Search results.
 * @param {string} searchTerm - Query string.
 * @param {string} searchMode - Active search mode.
 * @returns {Array} Scored and sorted results.
 */
function applyScoring(results, searchTerm, searchMode) {
  let scoredResults = calculateFinalScore(results, searchTerm)

  if (searchTerm) {
    scoredResults = sortResults(scoredResults, 'score')
  } else if (searchMode === 'history' || searchMode === 'tabs') {
    scoredResults = sortResults(scoredResults, 'lastVisited')
  }

  return scoredResults
}

/**
 * Filter results by minimum score and maximum count.
 *
 * @param {Array} results - Search results.
 * @param {string} searchMode - Active search mode.
 * @returns {Array} Filtered results.
 */
function filterResults(results, searchMode) {
  // Hard-coded minimum score threshold (implementation detail)
  const minScore = 30
  const maxResults = ext.opts.searchMaxResults
  const shouldLimit = searchMode !== 'tags' && searchMode !== 'folders' && searchMode !== 'tabs'

  // Fast path: no filtering needed
  if (minScore <= 0 && (!shouldLimit || results.length <= maxResults)) {
    return shouldLimit ? results.slice(0, maxResults) : results
  }

  // Single-pass filter and limit
  const filtered = []
  const limit = shouldLimit ? maxResults : results.length

  for (let i = 0; i < results.length && filtered.length < limit; i++) {
    if (results[i].score >= minScore) {
      filtered.push(results[i])
    }
  }

  return filtered
}

/**
 * Cache search results for better performance.
 *
 * @param {string} searchTerm - Query string.
 * @param {Array} results - Search results.
 */
function cacheResults(searchTerm, results) {
  if (searchTerm.trim() && ext.searchCache) {
    const cacheKey = `${searchTerm}_${ext.opts.searchStrategy}_${ext.model.searchMode || 'all'}`
    ext.searchCache.set(cacheKey, results)
  }
}

/**
 * Execute a search against the cached datasets based on the current UI state.
 *
 * @param {KeyboardEvent|InputEvent} [event] - Optional input event from the search field.
 * @returns {Promise<void>}
 */
export async function search(event) {
  // Create a promise that we'll track so Enter key can await completion
  const searchPromise = (async () => {
    try {
      if (shouldSkipSearch(event)) return
      if (!ext.initialized) {
        console.warn('Extension not initialized (yet). Skipping search')
        return
      }

      const startTime = Date.now()
      if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
        performance.mark('search-start')
      }

      // Get and clean up original search query
      let searchTerm = normalizeSearchTerm(ext.dom.searchInput.value)
      const originalSearchTerm = searchTerm

      // Check cache first for better performance (only for actual searches, not default results)
      if (useCachedResultsIfAvailable(searchTerm)) return

      // Handle empty search - show default results
      if (!searchTerm.trim()) {
        await handleEmptySearch()
        return
      }

      closeErrors()

      // Parse search mode and extract term
      const { mode: detectedMode, term: trimmedTerm } = resolveSearchMode(searchTerm)
      const searchMode = detectedMode
      searchTerm = trimmedTerm.trim()

      ext.model.searchTerm = searchTerm
      ext.model.searchMode = searchMode

      // Collect results
      let results = []

      // Add custom search alias results if in 'all' mode
      if (searchMode === 'all') {
        results.push(...collectCustomSearchAliasResults(searchTerm))
      }

      // Execute search if we have a search term after mode prefix is stripped
      // Note: searchTerm can become empty after resolveSearchMode() strips mode prefix (e.g., "t ", "b ")
      if (searchTerm) {
        results.push(...(await executeSearch(searchTerm, searchMode, ext.model, ext.opts)))
        addDirectUrlIfApplicable(searchTerm, results)

        // Add search engine result items
        if (searchMode === 'all' || searchMode === 'search') {
          results.push(...addSearchEngines(searchTerm))
        }
      } else {
        // Mode prefix without search term (e.g., "t ", "b ", "h ")
        // Show default entries for that mode instead of empty results
        results = await addDefaultEntries()
      }

      // Apply scoring and sorting
      results = applyScoring(results, searchTerm, searchMode)

      // Filter by score and max results
      results = filterResults(results, searchMode)

      // Apply highlighting only to the truncated result set (better performance)
      // For tags/folders, use the original term to include the marker (# or ~) in highlighting
      const highlightTerm = searchMode === 'tags' || searchMode === 'folders' ? originalSearchTerm : searchTerm
      results = highlightResults(results, highlightTerm)

      ext.model.result = results

      // Cache the results for better performance (only for actual searches)
      cacheResults(searchTerm, results)

      renderSearchResults()

      if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
        performance.mark('search-end')
        if (typeof performance.measure === 'function') {
          performance.measure('search-total', 'search-start', 'search-end')
        }
      }

      // Simple timing for debugging (only if debug is enabled)
      console.debug(`Search took ${Date.now() - startTime}ms`)
    } catch (err) {
      printError(err)
    }
  })()

  // Store the active search promise so Enter key can await it
  ext.model.activeSearchPromise = searchPromise
  searchPromise.finally(() => {
    if (ext.model.activeSearchPromise === searchPromise) {
      ext.model.activeSearchPromise = null
    }
  })

  return searchPromise
}

/**
 * Run the configured search algorithm and normalize the results.
 *
 * @param {'precise'|'fuzzy'} searchApproach - Algorithm to execute.
 * @param {string} searchTerm - Query string.
 * @param {string} [searchMode='all'] - Active search mode.
 * @returns {Promise<Array>} Matching entries across requested datasets.
 */
export async function searchWithAlgorithm(searchApproach, searchTerm, searchMode = 'all', data, options) {
  let results = []
  // Hard-coded minimum character length (implementation detail)
  const minMatchCharLength = 1
  if (searchTerm.length < minMatchCharLength) {
    return results
  }

  if (searchApproach === 'precise') {
    results = simpleSearch(searchMode, searchTerm, data)
  } else if (searchApproach === 'fuzzy') {
    results = await fuzzySearch(searchMode, searchTerm, data, options)
  } else {
    throw new Error(`Unknown search approach: ${searchApproach}`)
  }

  return results
}

/**
 * Sorts the results according to some modes
 *
 * @param {Array} results - Search results to sort
 * @param {string} sortMode - "score" | "lastVisited"
 * @returns {Array} Sorted results
 */
export function sortResults(results, sortMode) {
  if (sortMode === 'score') {
    results = results.sort((a, b) => {
      return b.score - a.score
    })
  } else if (sortMode === 'lastVisited') {
    results = results.sort((a, b) => {
      return (a.lastVisitSecondsAgo || 99999999) - (b.lastVisitSecondsAgo || 99999999)
    })
  } else {
    throw new Error(`Unknown sortMode="${sortMode}"`)
  }

  return results
}

/**
 * Apply highlighting to search results based on their search approach.
 *
 * @param {Array<Object>} results - Search results.
 * @param {string} searchTerm - Query string.
 * @returns {Array<Object>} Highlighted results.
 */
function highlightResults(results, searchTerm) {
  if (!results.length || !searchTerm) {
    return results
  }

  const terms = searchTerm.split(' ').filter(Boolean)
  if (terms.length === 0) {
    return results
  }

  // Pre-compile the regex once for all results
  const escapedTerms = terms
    .map((t) => escapeHtml(t))
    .map((t) => escapeRegex(t))
    .sort((a, b) => b.length - a.length)

  const highlightRegex = new RegExp(`(${escapedTerms.join('|')})`, 'gi')

  for (let i = 0; i < results.length; i++) {
    const entry = results[i]

    entry.highlightedTitle = highlightMatches(entry.title || entry.url, highlightRegex)
    entry.highlightedUrl = highlightMatches(entry.url, highlightRegex)

    if (entry.tagsArray) {
      entry.highlightedTagsArray = entry.tagsArray.map((tag) => highlightMatches(`#${tag}`, highlightRegex))
    }
    if (entry.folderArray) {
      entry.highlightedFolderArray = entry.folderArray.map((folder) => highlightMatches(`~${folder}`, highlightRegex))
    }
  }

  return results
}

// Re-export functions for backward compatibility
export { addDefaultEntries } from './defaultResults.js'
