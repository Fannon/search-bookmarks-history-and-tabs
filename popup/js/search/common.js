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

import { createSearchString } from '../helper/browserApi.js'
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

/**
 * Build the merged-results index used to deduplicate search responses.
 *
 * @param {Object} datasets - Raw search datasets partitioned by source.
 * @param {Array<Object>} [datasets.bookmarks] - Bookmark entries.
 * @param {Array<Object>} [datasets.tabs] - Tab entries.
 * @param {Array<Object>} [datasets.history] - History entries.
 * @returns {Map<string, Object>} Map keyed by URL containing merged metadata.
 */
export function prepareSearchIndex({ bookmarks = [], tabs = [], history = [] } = {}) {
  const mergedByUrl = new Map()

  accumulateDataset(mergedByUrl, bookmarks)
  accumulateDataset(mergedByUrl, tabs)
  accumulateDataset(mergedByUrl, history)

  for (const mergedEntry of mergedByUrl.values()) {
    finalizeMergedEntry(mergedEntry)
  }

  if (!ext.index) {
    ext.index = {}
  }
  ext.index.mergedResults = mergedByUrl

  return mergedByUrl
}

/**
 * Merge search results using the precomputed index.
 *
 * @param {Array<Object>} results - Raw search results across datasets.
 * @param {string} searchMode - Active search mode controlling type alignment.
 * @returns {Array<Object>} Deduplicated results enriched with merged metadata.
 */
export function mergeResultsFromIndex(results, searchMode) {
  if (!Array.isArray(results) || !results.length) {
    return results
  }

  let mergedIndex = ext.index?.mergedResults
  if (!mergedIndex || mergedIndex.size === undefined) {
    mergedIndex = prepareSearchIndex({
      bookmarks: ext.model?.bookmarks || [],
      tabs: ext.model?.tabs || [],
      history: ext.model?.history || [],
    })
  }

  if (!mergedIndex || !mergedIndex.size) {
    return results.map((entry) => ({ ...entry }))
  }

  const deduped = []
  const dedupedByKey = new Map()

  for (const result of results) {
    if (!result) {
      continue
    }

    const mergeKey =
      MERGEABLE_TYPES.has(result.type) && (result.originalUrl || result.url)
        ? result.originalUrl || result.url
        : undefined

    if (!mergeKey) {
      deduped.push({ ...result })
      continue
    }

    const base = mergedIndex.get(mergeKey)
    let mergedEntry = dedupedByKey.get(mergeKey)

    if (!mergedEntry) {
      mergedEntry = base ? cloneMergedEntry(base) : { ...result }
      applyModeOverride(mergedEntry, searchMode)

      if (result.titleHighlighted) {
        mergedEntry.titleHighlighted = result.titleHighlighted
      } else if (mergedEntry.titleHighlighted === undefined) {
        delete mergedEntry.titleHighlighted
      }

      if (result.urlHighlighted) {
        mergedEntry.urlHighlighted = result.urlHighlighted
      } else if (mergedEntry.urlHighlighted === undefined) {
        delete mergedEntry.urlHighlighted
      }

      if (result.active !== undefined) {
        mergedEntry.active = result.active
      }

      if (result.customBonusScore !== undefined) {
        mergedEntry.customBonusScore = result.customBonusScore
      }

      if (result.visitCount !== undefined && mergedEntry.visitCount === undefined) {
        mergedEntry.visitCount = result.visitCount
      }

      mergedEntry.searchScore = result.searchScore
      mergedEntry.searchApproach = result.searchApproach

      dedupedByKey.set(mergeKey, mergedEntry)
      deduped.push(mergedEntry)
      continue
    }

    if (result.titleHighlighted) {
      mergedEntry.titleHighlighted = result.titleHighlighted
    }

    if (result.urlHighlighted) {
      mergedEntry.urlHighlighted = result.urlHighlighted
    }

    if (result.active !== undefined) {
      mergedEntry.active = result.active
    }

    if (result.customBonusScore !== undefined) {
      mergedEntry.customBonusScore =
        mergedEntry.customBonusScore === undefined
          ? result.customBonusScore
          : Math.max(mergedEntry.customBonusScore, result.customBonusScore)
    }

    if (typeof result.searchScore === 'number') {
      const previousScore = typeof mergedEntry.searchScore === 'number' ? mergedEntry.searchScore : -Infinity
      if (result.searchScore > previousScore) {
        mergedEntry.searchApproach = result.searchApproach
      }
      mergedEntry.searchScore = Math.max(previousScore, result.searchScore)
    }
  }

  return deduped
}

const urlRegex = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/
const protocolRegex = /^[a-zA-Z]+:\/\//
const MERGEABLE_TYPES = new Set(['bookmark', 'tab', 'history'])
const TYPE_PRIORITY = ['bookmark', 'tab', 'history']
const MODE_TO_TYPE = {
  bookmarks: 'bookmark',
  tags: 'bookmark',
  folders: 'bookmark',
  tabs: 'tab',
  history: 'history',
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
 * Sort source identifiers using the defined priority order.
 *
 * @param {Array<string>} sourceTypes - Source identifiers to rank.
 * @returns {Array<string>} Sorted identifiers.
 */
function sortSourceTypes(sourceTypes) {
  return [...new Set(sourceTypes)].sort((a, b) => {
    const aIndex = TYPE_PRIORITY.indexOf(a)
    const bIndex = TYPE_PRIORITY.indexOf(b)
    if (aIndex === -1 && bIndex === -1) return 0
    if (aIndex === -1) return 1
    if (bIndex === -1) return -1
    return aIndex - bIndex
  })
}

/**
 * Resolve which source type should drive rendering metadata.
 *
 * @param {Array<string>} sourceTypes - Source identifiers contributing to an entry.
 * @returns {string|null} The preferred type, or null when unavailable.
 */
function determinePrimaryType(sourceTypes) {
  if (!sourceTypes || !sourceTypes.length) {
    return null
  }

  for (const type of TYPE_PRIORITY) {
    if (sourceTypes.includes(type)) {
      return type
    }
  }

  return sourceTypes[0] || null
}

/**
 * Merge metadata from a source item into an aggregated search result entry.
 *
 * @param {Object} target - Aggregated entry representing one URL.
 * @param {Object} source - Source-specific result being merged.
 */
function applySourceMetadata(target, source) {
  if (!source || !MERGEABLE_TYPES.has(source.type)) {
    return
  }

  // Track duplicate bookmarks BEFORE adding to sourceTypes
  // (only if this is the second+ bookmark being merged)
  if (source.type === 'bookmark' && target.type === 'bookmark') {
    // Check if target already has 'bookmark' in sourceTypes (before we add the new one)
    if (target.sourceTypes?.includes('bookmark')) {
      target.isDuplicateBookmark = true
      console.warn(
        `Duplicate bookmark detected: ${target.originalUrl || target.url} in ${target.folder} and ${source.folder}`,
      )
    }
  }

  const combinedTypes = target.sourceTypes ? [...target.sourceTypes, source.type] : [source.type]
  target.sourceTypes = sortSourceTypes(combinedTypes)

  // Apply type-specific metadata
  if (source.type === 'bookmark') {
    if (source.originalId !== undefined) {
      target.bookmarkOriginalId = source.originalId
    }
    // Merge tags from multiple bookmarks (combine and deduplicate)
    if (source.tagsArray?.length) {
      if (target.tagsArray?.length) {
        target.tagsArray = [...new Set([...target.tagsArray, ...source.tagsArray])]
      } else {
        target.tagsArray = [...source.tagsArray]
      }
      // Reconstruct tags string from merged array
      target.tags = target.tagsArray.map((tag) => `#${tag}`).join(' ')
    }
    // Folder assignment: last/first wins (no merging)
    if (source.folderArray?.length) {
      target.folderArray = [...source.folderArray]
      // Reconstruct folder string from array
      target.folder = source.folderArray.map((folder) => `~${folder}`).join(' ')
    }
    if (source.dateAdded !== undefined) {
      target.dateAdded = source.dateAdded
    }
    // Bookmarks have priority for title and titleHighlighted
    if (source.title) {
      target.title = source.title
    }
    if (source.titleHighlighted) {
      target.titleHighlighted = source.titleHighlighted
    }
  } else if (source.type === 'tab') {
    if (source.originalId !== undefined) {
      target.tabOriginalId = source.originalId
    }
    if (target.windowId === undefined && source.windowId !== undefined) {
      target.windowId = source.windowId
    }
  } else if (source.type === 'history') {
    if (source.originalId !== undefined) {
      target.historyOriginalId = source.originalId
    }
  }

  // Merge numeric fields (prefer more recent/higher values)
  if (source.lastVisitSecondsAgo !== undefined) {
    if (
      target.lastVisitSecondsAgo === undefined ||
      (typeof source.lastVisitSecondsAgo === 'number' &&
        (typeof target.lastVisitSecondsAgo !== 'number' || source.lastVisitSecondsAgo < target.lastVisitSecondsAgo))
    ) {
      target.lastVisitSecondsAgo = source.lastVisitSecondsAgo
    }
  }

  if (source.visitCount !== undefined) {
    target.visitCount =
      target.visitCount === undefined ? source.visitCount : Math.max(target.visitCount, source.visitCount)
  }

  if (source.searchScore !== undefined) {
    target.searchScore =
      target.searchScore === undefined ? source.searchScore : Math.max(target.searchScore, source.searchScore)
  }

  // Fallback values for common fields (only if not already set)
  if (!target.title && source.title) {
    target.title = source.title
  }
  if (!target.url && source.url) {
    target.url = source.url
  }
  if (!target.titleHighlighted && source.titleHighlighted) {
    target.titleHighlighted = source.titleHighlighted
  }
  if (!target.urlHighlighted && source.urlHighlighted) {
    target.urlHighlighted = source.urlHighlighted
  }
  if (!target.searchApproach && source.searchApproach) {
    target.searchApproach = source.searchApproach
  }

  const primaryType = determinePrimaryType(target.sourceTypes)
  if (primaryType) {
    target.type = primaryType
    if (primaryType === 'tab' && target.tabOriginalId !== undefined) {
      target.originalId = target.tabOriginalId
    } else if (primaryType === 'bookmark' && target.bookmarkOriginalId !== undefined) {
      target.originalId = target.bookmarkOriginalId
    } else if (primaryType === 'history' && target.historyOriginalId !== undefined) {
      target.originalId = target.historyOriginalId
    }
  }
}

/**
 * Clone a merged entry so callers can safely mutate without affecting the cache.
 *
 * @param {Object} entry - Entry retrieved from the merged index.
 * @returns {Object} Shallow clone with defensive copies for arrays.
 */
function cloneMergedEntry(entry) {
  const clone = { ...entry }
  if (entry.sourceTypes) {
    clone.sourceTypes = [...entry.sourceTypes]
  }
  if (entry.tagsArray) {
    clone.tagsArray = [...entry.tagsArray]
  }
  if (entry.folderArray) {
    clone.folderArray = [...entry.folderArray]
  }
  return clone
}

/**
 * Adds dataset entries to the merged-results index.
 *
 * @param {Map<string, Object>} mergedByUrl - Target index map.
 * @param {Array<Object>} dataset - Dataset to integrate.
 */
function accumulateDataset(mergedByUrl, dataset) {
  if (!Array.isArray(dataset)) {
    return
  }

  for (const entry of dataset) {
    if (!entry || !MERGEABLE_TYPES.has(entry.type)) {
      continue
    }

    const mergeKey = entry.originalUrl || entry.url
    if (!mergeKey) {
      continue
    }

    const existing = mergedByUrl.get(mergeKey)
    if (existing) {
      applySourceMetadata(existing, entry)
    } else {
      const base = { ...entry }
      applySourceMetadata(base, entry)
      mergedByUrl.set(mergeKey, base)
    }
  }
}

/**
 * Finalise merged entry metadata (search strings, ordering helpers, etc.).
 *
 * @param {Object} entry - Entry to finalise.
 */
function finalizeMergedEntry(entry) {
  if (!entry) {
    return
  }

  if (entry.sourceTypes) {
    entry.sourceTypes = sortSourceTypes(entry.sourceTypes)
  }

  if (!entry.url && entry.originalUrl) {
    entry.url = cleanUpUrl(entry.originalUrl)
  }

  entry.searchString = createSearchString(entry.title, entry.url, entry.tags, entry.folder)
  entry.searchStringLower = entry.searchString.toLowerCase()
}

/**
 * Align merged entry metadata with the active search mode type.
 *
 * @param {Object} entry - Entry to adjust.
 * @param {string} searchMode - Active search mode.
 */
function applyModeOverride(entry, searchMode) {
  if (!entry || !searchMode) {
    return
  }

  const targetType = MODE_TO_TYPE[searchMode]
  if (!targetType) {
    return
  }

  if (!entry.sourceTypes || !entry.sourceTypes.includes(targetType)) {
    return
  }

  if (targetType === 'bookmark' && entry.bookmarkOriginalId !== undefined) {
    entry.originalId = entry.bookmarkOriginalId
  } else if (targetType === 'tab' && entry.tabOriginalId !== undefined) {
    entry.originalId = entry.tabOriginalId
  } else if (targetType === 'history' && entry.historyOriginalId !== undefined) {
    entry.originalId = entry.historyOriginalId
  }

  entry.type = targetType
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

      // Add search engine result items
      if (searchMode === 'all' || searchMode === 'search') {
        results.push(...addSearchEngines(searchTerm))
      }
    } else {
      results = await addDefaultEntries()
    }

    // Merge duplicate URLs using the precomputed index
    results = mergeResultsFromIndex(results, searchMode)

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
