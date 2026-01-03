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
 * 5. Limit results to max count.
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

// Export scoring function for other modules
export { calculateFinalScore } from './scoring.js'

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
  return (
    event &&
    (['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(event.key) || event.ctrlKey || event.altKey || event.shiftKey)
  )
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
  // DUPLICATE_SPACE_REGEX removed to support "  " double-space separator for hybrid taxonomy search (e.g. "@group  search")
  return normalized
}

/**
 * Check if the search term is cached and render cached results if available.
 *
 * @param {string} searchTerm - The search term to check.
 * @returns {boolean} True if cached results were used.
 */
function getCacheKey(term) {
  return `${term}_${ext.opts.searchStrategy}_${ext.model.searchMode || 'all'}`
}

function useCachedResultsIfAvailable(searchTerm) {
  if (!searchTerm.trim() || !ext.searchCache) return false
  const results = ext.searchCache.get(getCacheKey(searchTerm))
  if (results) {
    ext.model.searchTerm = searchTerm
    ext.model.result = results
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
  if (searchMode === 'tags') return searchTaxonomy(searchTerm, 'tags', data.bookmarks)
  if (searchMode === 'folders') return searchTaxonomy(searchTerm, 'folder', data.bookmarks)
  if (searchMode === 'groups') return searchTaxonomy(searchTerm, 'group', data.tabs)
  if (options.searchStrategy === 'fuzzy') return fuzzySearch(searchMode, searchTerm, data, options)
  // By default fall back to simple search. This is better than going with errors.
  // Changing this is a matter of a click in the UI, anyway.
  return simpleSearch(searchMode, searchTerm, data)
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
  const scoredResults = calculateFinalScore(results, searchTerm)

  if (searchTerm) {
    return sortResults(scoredResults, 'score')
  }

  if (searchMode === 'history' || searchMode === 'tabs') {
    return sortResults(scoredResults, 'lastVisited')
  }

  return scoredResults
}

/**
 * Limit results by maximum count.
 *
 * @param {Array} results - Search results.
 * @param {string} searchMode - Active search mode.
 * @returns {Array} Filtered results.
 */
function filterResults(results, searchMode) {
  const maxResults = ext.opts.searchMaxResults
  const shouldLimit =
    searchMode !== 'tags' && searchMode !== 'folders' && searchMode !== 'tabs' && searchMode !== 'groups'

  // If we don't need to limit, or we're already under the limit, return as is.
  if (!shouldLimit || results.length <= maxResults) {
    return results
  }

  return results.slice(0, maxResults)
}

/**
 * Cache search results for better performance.
 *
 * @param {string} searchTerm - Query string.
 * @param {Array} results - Search results.
 */
function cacheResults(searchTerm, results) {
  if (searchTerm.trim() && ext.searchCache) {
    ext.searchCache.set(getCacheKey(searchTerm), results)
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
    const startTime = Date.now()
    try {
      if (shouldSkipSearch(event) || !ext.initialized) return

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

      // Limit to max results
      results = filterResults(results, searchMode)

      // Apply highlighting only to the truncated result set (better performance)
      // For taxonomy modes, use the original term to include the marker (#, ~, or @) in highlighting
      const highlightTerm =
        searchMode === 'tags' || searchMode === 'folders' || searchMode === 'groups' ? originalSearchTerm : searchTerm
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

      // Simple timing for debugging
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
 * Sorts the results according to some modes
 *
 * @param {Array} results - Search results to sort
 * @param {string} sortMode - "score" | "lastVisited"
 * @returns {Array} Sorted results
 */
export function sortResults(results, sortMode) {
  if (sortMode === 'score') return results.sort((a, b) => b.score - a.score)
  if (sortMode === 'lastVisited')
    return results.sort((a, b) => (a.lastVisitSecondsAgo || 99999999) - (b.lastVisitSecondsAgo || 99999999))
  throw new Error(`Unknown sortMode="${sortMode}"`)
}

/**
 * Apply highlighting to search results based on their search approach.
 *
 * @param {Array<Object>} results - Search results.
 * @param {string} searchTerm - Query string.
 * @returns {Array<Object>} Highlighted results.
 */
function highlightResults(results, searchTerm) {
  const resultsLen = results.length
  if (resultsLen === 0 || !searchTerm) {
    return results
  }

  // Extract and clean terms once
  const rawTerms = searchTerm.split(' ')
  const terms = []
  for (let i = 0; i < rawTerms.length; i++) {
    const t = rawTerms[i]
    if (t) terms.push(t)
  }

  if (terms.length === 0) {
    return results
  }

  // Pre-compile the regex once for all results
  const escapedTerms = terms
    .map((t) => escapeHtml(t))
    .map((t) => escapeRegex(t))
    .sort((a, b) => b.length - a.length)

  const highlightRegex = new RegExp(`(${escapedTerms.join('|')})`, 'gi')

  for (let i = 0; i < resultsLen; i++) {
    const entry = results[i]

    entry.highlightedTitle = highlightMatches(entry.title || entry.url, highlightRegex)
    entry.highlightedUrl = highlightMatches(entry.url, highlightRegex)

    const tagsArray = entry.tagsArray
    if (tagsArray) {
      const tagCount = tagsArray.length
      const highlightedTags = new Array(tagCount)
      for (let j = 0; j < tagCount; j++) {
        highlightedTags[j] = highlightMatches(`#${tagsArray[j]}`, highlightRegex)
      }
      entry.highlightedTagsArray = highlightedTags
    }

    const folderArray = entry.folderArray
    if (folderArray) {
      const folderCount = folderArray.length
      const highlightedFolders = new Array(folderCount)
      for (let j = 0; j < folderCount; j++) {
        highlightedFolders[j] = highlightMatches(`~${folderArray[j]}`, highlightRegex)
      }
      entry.highlightedFolderArray = highlightedFolders
    }

    if (entry.group) {
      entry.highlightedGroup = highlightMatches(`@${entry.group}`, highlightRegex)
    }
  }

  return results
}

// Re-export functions for backward compatibility
export { addDefaultEntries } from './defaultResults.js'
