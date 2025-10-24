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
 */

import { cleanUpUrl, generateRandomId } from '../helper/utils.js'
import { closeErrors, printError } from '../view/errorView.js'
import { renderSearchResults } from '../view/searchView.js'
import { fuzzySearch } from './fuzzySearch.js'
import { calculateFinalScore } from './scoring.js'
import { simpleSearch } from './simpleSearch.js'
import { searchTaxonomy } from './taxonomySearch.js'
import { resolveSearchMode } from './queryParser.js'
import { addSearchEngines, collectCustomSearchAliasResults } from './searchEngines.js'
import { addDefaultEntries } from './defaultResults.js'

// Re-export scoring function for backward compatibility
export { calculateFinalScore }

const urlRegex = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/
const protocolRegex = /^[a-zA-Z]+:\/\//
const MERGEABLE_TYPES = new Set(['bookmark', 'tab', 'history'])
const TYPE_PRIORITY = ['bookmark', 'tab', 'history']
const MODE_TYPE_PRIORITY = {
  bookmarks: ['bookmark', 'tab', 'history'],
  tags: ['bookmark', 'tab', 'history'],
  folders: ['bookmark', 'tab', 'history'],
  tabs: ['tab', 'bookmark', 'history'],
  history: ['history', 'tab', 'bookmark'],
}

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
    console.debug(`Using cached results for key "${cacheKey}"`)
    ext.model.searchTerm = searchTerm
    ext.model.result = ext.searchCache.get(cacheKey)
    renderSearchResults(ext.model.result)
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
  renderSearchResults(ext.model.result)
}

/**
 * Execute the configured search algorithm and return results.
 *
 * @param {string} searchTerm - Query string.
 * @param {string} searchMode - Active search mode.
 * @returns {Promise<Array>} Search results.
 */
async function executeSearch(searchTerm, searchMode) {
  const results = []

  if (searchMode === 'tags') {
    return searchTaxonomy(searchTerm, 'tags', ext.model.bookmarks)
  } else if (searchMode === 'folders') {
    return searchTaxonomy(searchTerm, 'folder', ext.model.bookmarks)
  } else if (ext.opts.searchStrategy === 'fuzzy') {
    results.push(...(await searchWithAlgorithm('fuzzy', searchTerm, searchMode)))
  } else if (ext.opts.searchStrategy === 'precise') {
    results.push(...(await searchWithAlgorithm('precise', searchTerm, searchMode)))
  } else {
    console.error(`Unsupported option "search.approach" value: "${ext.opts.searchStrategy}"`)
    // Fall back to use precise search instead of crashing entirely
    results.push(...(await searchWithAlgorithm('precise', searchTerm, searchMode)))
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
      titleHighlighted: `Direct: "<mark>${cleanUpUrl(url)}</mark>"`,
      url: cleanUpUrl(url),
      urlHighlighted: cleanUpUrl(url),
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
  // Filter out all search results below a certain score
  let filtered = results.filter((el) => el.score >= ext.opts.scoreMinScore)

  // Only render maxResults if given (to improve render performance)
  // Not applied on tabs, tag and folder search
  if (
    searchMode !== 'tags' &&
    searchMode !== 'folders' &&
    searchMode !== 'tabs' &&
    filtered.length > ext.opts.searchMaxResults
  ) {
    filtered = filtered.slice(0, ext.opts.searchMaxResults)
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
  try {
    if (shouldSkipSearch(event)) return
    if (!ext.initialized) {
      console.warn('Extension not initialized (yet). Skipping search')
      return
    }

    const startTime = Date.now()

    // Get and clean up original search query
    let searchTerm = normalizeSearchTerm(ext.dom.searchInput.value)

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
    let searchMode = detectedMode
    searchTerm = trimmedTerm.trim()

    ext.model.searchTerm = searchTerm
    ext.model.searchMode = searchMode

    // Collect results
    let results = []

    // Add custom search alias results if in 'all' mode
    if (searchMode === 'all') {
      results.push(...collectCustomSearchAliasResults(searchTerm))
    }

    // Execute search if we have a search term
    if (searchTerm) {
      results.push(...(await executeSearch(searchTerm, searchMode)))
      addDirectUrlIfApplicable(searchTerm, results)

      if (searchTerm.trim()) {
        results = mergeDuplicateResults(results, searchMode)
      }

      // Add search engine result items
      if (searchMode === 'all' || searchMode === 'search') {
        results.push(...addSearchEngines(searchTerm))
      }
    } else {
      results = await addDefaultEntries()
    }

    // Apply scoring and sorting
    results = applyScoring(results, searchTerm, searchMode)

    // Filter by score and max results
    results = filterResults(results, searchMode)

    ext.model.result = results
    ext.dom.resultCounter.innerText = `(${results.length})`

    // Cache the results for better performance (only for actual searches)
    cacheResults(searchTerm, results)

    renderSearchResults(results)

    // Simple timing for debugging (only if debug is enabled)
    console.debug('Search completed in ' + (Date.now() - startTime) + 'ms')
  } catch (err) {
    printError(err)
  }
}

/**
 * Run the configured search algorithm and normalize the results.
 *
 * @param {'precise'|'fuzzy'} searchApproach - Algorithm to execute.
 * @param {string} searchTerm - Query string.
 * @param {string} [searchMode='all'] - Active search mode.
 * @returns {Promise<Array>} Matching entries across requested datasets.
 */
export async function searchWithAlgorithm(searchApproach, searchTerm, searchMode = 'all') {
  let results = []
  // If the search term is below minMatchCharLength, no point in starting search
  if (searchTerm.length < ext.opts.searchMinMatchCharLength) {
    return results
  }

  if (searchApproach === 'precise') {
    results = simpleSearch(searchMode, searchTerm)
  } else if (searchApproach === 'fuzzy') {
    results = await fuzzySearch(searchMode, searchTerm)
  } else {
    throw new Error('Unknown search approach: ' + searchApproach)
  }

  return results
}

function mergeDuplicateResults(results, searchMode) {
  if (!Array.isArray(results) || results.length === 0) {
    return results
  }

  const mergedByKey = new Map()
  const mergedResults = []

  for (const result of results) {
    if (!result) {
      continue
    }

    const mergeKey = getMergeKey(result)
    if (!mergeKey) {
      mergedResults.push(result)
      continue
    }

    let entry = mergedByKey.get(mergeKey)
    if (!entry) {
      entry = createMergedEntry(result)
      mergedByKey.set(mergeKey, entry)
      mergedResults.push(entry)
    } else {
      mergeEntry(entry, result)
    }
  }

  for (const entry of mergedByKey.values()) {
    finalizeMergedEntry(entry, searchMode)
  }

  return mergedResults
}

function getMergeKey(result) {
  if (!MERGEABLE_TYPES.has(result.type)) {
    return null
  }
  return result.originalUrl || result.url || null
}

function createMergedEntry(result) {
  const entry = cloneResult(result)
  entry.sourceTypes = [result.type]
  if (result.type === 'bookmark') {
    entry.bookmarkOriginalId = result.originalId
  } else if (result.type === 'tab') {
    entry.tabOriginalId = result.originalId
    entry.isOpenTab = true
  } else if (result.type === 'history') {
    entry.historyOriginalId = result.originalId
  }
  if (result.isOpenTab) {
    entry.isOpenTab = true
  }
  return entry
}

function cloneResult(result) {
  const clone = { ...result }
  if (result.tagsArray) {
    clone.tagsArray = [...result.tagsArray]
  }
  if (result.folderArray) {
    clone.folderArray = [...result.folderArray]
  }
  return clone
}

function mergeEntry(entry, result) {
  if (!entry.sourceTypes.includes(result.type)) {
    entry.sourceTypes.push(result.type)
  } else if (result.type === 'bookmark') {
    entry.isDuplicateBookmark = true
    const existingFolder =
      Array.isArray(entry.folderArray) && entry.folderArray.length ? entry.folderArray.join(' / ') : 'n/a'
    const incomingFolder =
      Array.isArray(result.folderArray) && result.folderArray.length ? result.folderArray.join(' / ') : 'n/a'
    console.warn(
      `Duplicate bookmark detected for ${
        entry.originalUrl || entry.url || 'unknown URL'
      } (existing folder: ${existingFolder}, incoming folder: ${incomingFolder})`,
    )
  }

  const resultScore = typeof result.searchScore === 'number' ? result.searchScore : Number.NEGATIVE_INFINITY
  const entryScore = typeof entry.searchScore === 'number' ? entry.searchScore : Number.NEGATIVE_INFINITY

  if (resultScore > entryScore) {
    entry.searchScore = resultScore
    entry.searchApproach = result.searchApproach
    if (result.titleHighlighted !== undefined) {
      entry.titleHighlighted = result.titleHighlighted
    }
    if (result.urlHighlighted !== undefined) {
      entry.urlHighlighted = result.urlHighlighted
    }
  } else if (entry.searchScore === undefined) {
    entry.searchScore = resultScore
    entry.searchApproach = result.searchApproach
  } else {
    entry.searchScore = Math.max(entryScore, resultScore)
    if (entry.titleHighlighted === undefined && result.titleHighlighted !== undefined) {
      entry.titleHighlighted = result.titleHighlighted
    }
    if (entry.urlHighlighted === undefined && result.urlHighlighted !== undefined) {
      entry.urlHighlighted = result.urlHighlighted
    }
  }

  if (result.type === 'bookmark') {
    entry.bookmarkOriginalId = entry.bookmarkOriginalId ?? result.originalId
    if (result.title) {
      entry.title = result.title
    }
    if (result.tagsArray?.length) {
      entry.tagsArray = mergeUniqueValues(entry.tagsArray, result.tagsArray)
    }
    if (!entry.folderArray?.length && result.folderArray?.length) {
      entry.folderArray = [...result.folderArray]
    }
    if (result.dateAdded !== undefined && entry.dateAdded === undefined) {
      entry.dateAdded = result.dateAdded
    }
    if (result.customBonusScore !== undefined) {
      entry.customBonusScore =
        entry.customBonusScore === undefined
          ? result.customBonusScore
          : Math.max(entry.customBonusScore, result.customBonusScore)
    }
  } else if (result.type === 'tab') {
    entry.tabOriginalId = result.originalId
    entry.isOpenTab = true
    entry.active = entry.active || result.active
    if (entry.windowId === undefined && result.windowId !== undefined) {
      entry.windowId = result.windowId
    }
  } else if (result.type === 'history') {
    entry.historyOriginalId = result.originalId
  }

  if (result.lastVisitSecondsAgo !== undefined) {
    if (
      entry.lastVisitSecondsAgo === undefined ||
      (typeof result.lastVisitSecondsAgo === 'number' &&
        (typeof entry.lastVisitSecondsAgo !== 'number' || result.lastVisitSecondsAgo < entry.lastVisitSecondsAgo))
    ) {
      entry.lastVisitSecondsAgo = result.lastVisitSecondsAgo
    }
  }

  if (result.visitCount !== undefined) {
    entry.visitCount =
      entry.visitCount === undefined ? result.visitCount : Math.max(entry.visitCount, result.visitCount)
  }

  if (result.active) {
    entry.active = true
  }

  if (!entry.url && result.url) {
    entry.url = result.url
  }
  if (!entry.originalUrl && result.originalUrl) {
    entry.originalUrl = result.originalUrl
  }
  if (result.isOpenTab) {
    entry.isOpenTab = true
  }
}

function finalizeMergedEntry(entry, searchMode) {
  entry.sourceTypes = Array.from(new Set(entry.sourceTypes)).sort(
    (a, b) => TYPE_PRIORITY.indexOf(a) - TYPE_PRIORITY.indexOf(b),
  )

  const typeOrder = MODE_TYPE_PRIORITY[searchMode] || TYPE_PRIORITY
  const finalType = typeOrder.find((type) => entry.sourceTypes.includes(type)) || entry.sourceTypes[0] || entry.type
  entry.type = finalType || entry.type

  if (finalType === 'bookmark' && entry.bookmarkOriginalId !== undefined) {
    entry.originalId = entry.bookmarkOriginalId
  } else if (finalType === 'tab' && entry.tabOriginalId !== undefined) {
    entry.originalId = entry.tabOriginalId
  } else if (finalType === 'history' && entry.historyOriginalId !== undefined) {
    entry.originalId = entry.historyOriginalId
  } else if (entry.originalId === undefined) {
    entry.originalId = entry.bookmarkOriginalId ?? entry.tabOriginalId ?? entry.historyOriginalId ?? entry.originalId
  }

  if (entry.tagsArray?.length) {
    entry.tagsArray = mergeUniqueValues([], entry.tagsArray)
    entry.tags = entry.tagsArray.map((tag) => `#${tag}`).join(' ')
  } else {
    delete entry.tags
  }

  if (entry.folderArray?.length) {
    entry.folder = entry.folderArray.map((folder) => `~${folder}`).join(' ')
  } else {
    delete entry.folder
  }

  if (!entry.url && entry.originalUrl) {
    entry.url = cleanUpUrl(entry.originalUrl)
  }

  const title = entry.title || ''
  const url = entry.url || ''
  const tags = entry.tags || ''
  const folder = entry.folder || ''
  entry.searchString = buildSearchString(title, url, tags, folder)
  entry.searchStringLower = entry.searchString.toLowerCase()
}

function mergeUniqueValues(target = [], source = []) {
  const merged = new Set(target || [])
  for (const value of source || []) {
    if (value !== undefined && value !== null && value !== '') {
      merged.add(value)
    }
  }
  return Array.from(merged)
}

function buildSearchString(title, url, tags, folder) {
  if (!url) {
    return ''
  }
  const separator = '¦'
  let searchString = ''
  if (title && !title.toLowerCase().includes(url.toLowerCase())) {
    searchString += title + separator + url
  } else {
    searchString += url
  }
  if (tags) {
    searchString += separator + tags
  }
  if (folder) {
    searchString += separator + folder
  }
  return searchString
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

// Re-export functions for backward compatibility
export { addDefaultEntries } from './defaultResults.js'
