/**
 * @file Coordinates popup search across bookmarks, tabs, history, and aliases.
 * Handles query parsing, caching, strategy selection, and result rendering.
 */

import { getBrowserTabs } from '../helper/browserApi.js'
import { cleanUpUrl, printError } from '../helper/utils.js'
import { closeErrors } from '../initSearch.js'
import { renderSearchResults } from '../view/searchView.js'
import { fuzzySearch } from './fuzzySearch.js'
import { calculateFinalScore } from './scoring.js'
import { simpleSearch } from './simpleSearch.js'
import { searchTaxonomy } from './taxonomySearch.js'

// Re-export scoring function for backward compatibility
export { calculateFinalScore }

const urlRegex = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/
const protocolRegex = /^[a-zA-Z]+:\/\//
const SEARCH_MODE_PREFIXES = [
  ['h ', 'history'],
  ['b ', 'bookmarks'],
  ['t ', 'tabs'],
  ['s ', 'search'],
]
const SEARCH_MODE_MARKERS = {
  '#': 'tags',
  '~': 'folders',
}

/** Maps search modes to the datasets queried from `ext.model`. */
const MODE_TARGETS = {
  history: ['tabs', 'history'],
  bookmarks: ['bookmarks'],
  tabs: ['tabs'],
  search: [],
  all: ['bookmarks', 'tabs', 'history'],
}

/**
 * Resolve dataset keys for the given search mode.
 * @param {string} searchMode
 * @returns {string[]}
 */
export function resolveSearchTargets(searchMode) {
  return MODE_TARGETS[searchMode] || MODE_TARGETS.all
}

/** Attach a default `searchScore` of 1 to a result entry. */
const withDefaultScore = (entry) => ({
  searchScore: 1,
  ...entry,
})

/**
 * Create a unique id for synthetic result entries.
 * @returns {string}
 */
function generateRandomId() {
  return Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36)
}

/**
 * Execute the full search pipeline, optionally reacting to input events.
 * @param {KeyboardEvent|InputEvent} [event]
 * @returns {Promise<void>}
 */
export async function search(event) {
  try {
    if (event) {
      // Don't execute search on navigation keys
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'Enter' || event.key === 'Escape') {
        return
      }
      // Don't execute search on modifier keys
      if (event.key === 'Control' || event.ctrlKey || event.key === 'Alt' || event.altKey || event.key === 'Shift') {
        return
      }
    }

    if (!ext.initialized) {
      console.warn('Extension not initialized (yet). Skipping search')
      return
    }

    const startTime = Date.now()

    // Get and clean up original search query
    let searchTerm = ext.dom.searchInput.value || ''
    searchTerm = searchTerm.trimStart().toLowerCase()
    searchTerm = searchTerm.replace(/ +(?= )/g, '') // Remove duplicate spaces

    // Check cache first for better performance (only for actual searches, not default results)
    if (searchTerm.trim() && ext.searchCache) {
      const cacheKey = `${searchTerm}_${ext.opts.searchStrategy}_${ext.model.searchMode || 'all'}`
      if (ext.searchCache.has(cacheKey)) {
        console.debug(`Using cached results for key "${cacheKey}"`)
        ext.model.searchTerm = searchTerm
        ext.model.result = ext.searchCache.get(cacheKey)
        renderSearchResults(ext.model.result)
        return
      }
    }

    if (!searchTerm.trim()) {
      ext.model.searchTerm = '' // Clear search term for default results
      ext.model.result = await addDefaultEntries()
      renderSearchResults(ext.model.result)
      return // Early return if no search term
    }

    closeErrors()

    ext.model.result = []
    const { mode: detectedMode, term: trimmedTerm } = resolveSearchMode(searchTerm)
    let searchMode = detectedMode
    searchTerm = trimmedTerm

    if (searchMode === 'all') {
      ext.model.result.push(...collectCustomSearchAliasResults(searchTerm))
    }

    searchTerm = searchTerm.trim()

    ext.model.searchTerm = searchTerm
    ext.model.searchMode = searchMode

    if (searchTerm) {
      if (searchMode === 'tags') {
        ext.model.result = searchTaxonomy(searchTerm, 'tags', ext.model.bookmarks)
      } else if (searchMode === 'folders') {
        ext.model.result = searchTaxonomy(searchTerm, 'folder', ext.model.bookmarks)
      } else if (ext.opts.searchStrategy === 'fuzzy') {
        ext.model.result.push(...(await searchWithAlgorithm('fuzzy', searchTerm, searchMode)))
      } else if (ext.opts.searchStrategy === 'precise') {
        ext.model.result.push(...(await searchWithAlgorithm('precise', searchTerm, searchMode)))
      } else {
        console.error(`Unsupported option "search.approach" value: "${ext.opts.searchStrategy}"`)
        // Fall back to use precise search instead of crashing entirely
        ext.model.result.push(...(await searchWithAlgorithm('precise', searchTerm, searchMode)))
      }
      if (
        ext.opts.enableDirectUrl &&
        urlRegex.test(searchTerm) &&
        ext.model.result.length < ext.opts.searchMaxResults
      ) {
        const url = protocolRegex.test(searchTerm) ? searchTerm : `https://${searchTerm.replace(/^\/+/, '')}`
        ext.model.result.push({
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

      // Add search engine result items
      if (searchMode === 'all' || searchMode === 'search') {
        ext.model.result.push(...addSearchEngines(searchTerm))
      }
      ext.model.result = calculateFinalScore(ext.model.result, searchTerm)
      ext.model.result = sortResults(ext.model.result, 'score')
    } else {
      ext.model.result = await addDefaultEntries()
      ext.model.result = calculateFinalScore(ext.model.result, searchTerm)
      if (searchMode === 'history' || searchMode === 'tabs') {
        ext.model.result = sortResults(ext.model.result, 'lastVisited')
      }
    }

    // Filter out all search results below a certain score
    ext.model.result = ext.model.result.filter((el) => el.score >= ext.opts.scoreMinScore)

    // Only render maxResults if given (to improve render performance)
    // Not applied on tabs, tag and folder search
    if (
      searchMode !== 'tags' &&
      searchMode !== 'folders' &&
      searchMode !== 'tabs' &&
      ext.model.result.length > ext.opts.searchMaxResults
    ) {
      ext.model.result = ext.model.result.slice(0, ext.opts.searchMaxResults)
    }

    ext.dom.resultCounter.innerText = `(${ext.model.result.length})`

    // Cache the results for better performance (only for actual searches)
    if (searchTerm.trim() && ext.searchCache) {
      const cacheKey = `${searchTerm}_${ext.opts.searchStrategy}_${ext.model.searchMode || 'all'}`
      ext.searchCache.set(cacheKey, ext.model.result)
    }

    renderSearchResults(ext.model.result)

    // Simple timing for debugging (only if debug is enabled)
    console.debug('Search completed in ' + (Date.now() - startTime) + 'ms')
  } catch (err) {
    printError(err)
  }
}

/**
 * Run a search strategy and return normalized results.
 * @param {'precise'|'fuzzy'} searchApproach
 * @param {string} searchTerm
 * @param {string} [searchMode='all']
 * @returns {Promise<Array>}
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
 * Sort results by score or last-visited timestamp.
 * @param {Array} results
 * @param {string} sortMode
 * @returns {Array}
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
 * Build default result sets when no explicit search term is provided.
 * @returns {Promise<Array>}
 */
export async function addDefaultEntries() {
  let results = []

  if (ext.model.searchMode === 'history' && ext.model.history) {
    // Display recent history by default
    results = ext.model.history.map(withDefaultScore)
  } else if (ext.model.searchMode === 'tabs' && ext.model.tabs) {
    // Display last opened tabs by default
    results = ext.model.tabs.map(withDefaultScore).sort((a, b) => {
      return a.lastVisitSecondsAgo - b.lastVisitSecondsAgo
    })
  } else if (ext.model.searchMode === 'bookmarks' && ext.model.bookmarks) {
    // Display all bookmarks by default
    results = ext.model.bookmarks.map(withDefaultScore)
  } else {
    // Default: Find bookmarks that match current page URL
    try {
      const [tab] = await getBrowserTabs({ active: true, currentWindow: true })
      if (tab && tab.url) {
        // Use the current tab's URL instead of window.location.href for accuracy
        let currentUrl = tab.url.replace(/[/#]$/, '')

        // Find bookmarks that match current page URL (with some flexibility)
        const matchingBookmarks = ext.model.bookmarks.filter((el) => {
          if (!el.originalUrl) return false
          const bookmarkUrl = el.originalUrl.replace(/[/#]$/, '')
          return (
            bookmarkUrl === currentUrl ||
            bookmarkUrl === currentUrl.replace(/^https?:\/\//, '') ||
            currentUrl === bookmarkUrl.replace(/^https?:\/\//, '')
          )
        })

        if (matchingBookmarks.length > 0) {
          results.push(...matchingBookmarks.map(withDefaultScore))
        }
      }
    } catch (err) {
      console.warn('Could not get current tab for default entries:', err)
    }

    // Always add recently visited tabs when option is enabled and no search term
    if (ext.model.tabs && ext.opts.maxRecentTabsToShow > 0) {
      const recentTabs = ext.model.tabs
        .filter((tab) => tab && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('about:'))
        .map(withDefaultScore)
        .sort((a, b) => {
          // Sort by last accessed time (most recent first)
          // Handle cases where last accessed might be undefined
          const aTime = a.lastVisitSecondsAgo || Number.MAX_SAFE_INTEGER
          const bTime = b.lastVisitSecondsAgo || Number.MAX_SAFE_INTEGER
          return aTime - bTime
        })
        .slice(0, ext.opts.maxRecentTabsToShow) // Show most recent tabs

      results.push(...recentTabs)
    }
  }

  ext.model.result = results
  return results
}

/**
 * Create external search engine entries for the query.
 * @param {string} searchTerm
 * @returns {Array}
 */
function addSearchEngines(searchTerm) {
  const results = []
  if (ext.opts.enableSearchEngines) {
    for (const searchEngine of ext.opts.searchEngineChoices) {
      results.push(getCustomSearchEngineResult(searchTerm, searchEngine.name, searchEngine.urlPrefix))
    }
  }
  return results
}

/**
 * Build a single result entry for a custom search engine.
 * @param {string} searchTerm
 * @param {string} name
 * @param {string} urlPrefix
 * @param {string} [urlBlank]
 * @param {boolean} [custom=false]
 * @returns {Object}
 */
function getCustomSearchEngineResult(searchTerm, name, urlPrefix, urlBlank, custom) {
  let url
  let title = `${name}: "${searchTerm}"`
  let titleHighlighted = `${name}: "<mark>${searchTerm}</mark>"`
  if (urlBlank && !searchTerm.trim()) {
    url = urlBlank
    title = name
    titleHighlighted = name
  } else if (urlPrefix.includes('$s')) {
    url = urlPrefix.replace('$s', encodeURIComponent(searchTerm))
  } else {
    url = urlPrefix + encodeURIComponent(searchTerm)
  }
  return {
    type: custom ? 'customSearch' : 'search',
    title: title,
    titleHighlighted: titleHighlighted,
    url: cleanUpUrl(url),
    urlHighlighted: cleanUpUrl(url),
    originalUrl: url,
    originalId: generateRandomId(),
    searchScore: 1,
  }
}

/**
 * Determine search mode from prefixes or taxonomy markers.
 * @param {string} searchTerm
 * @returns {{mode: string, term: string}}
 */
function resolveSearchMode(searchTerm) {
  let mode = 'all'
  let term = searchTerm

  for (const [prefix, candidate] of SEARCH_MODE_PREFIXES) {
    if (term.startsWith(prefix)) {
      mode = candidate
      term = term.slice(prefix.length)
      return { mode, term }
    }
  }

  const marker = SEARCH_MODE_MARKERS[term[0]]
  if (marker) {
    mode = marker
    term = term.slice(1)
  }

  return { mode, term }
}

/**
 * Resolve custom search engine aliases at the start of a query.
 * @param {string} searchTerm
 * @returns {Array}
 */
function collectCustomSearchAliasResults(searchTerm) {
  if (!ext.opts.customSearchEngines) {
    return []
  }

  const results = []
  for (const customSearchEngine of ext.opts.customSearchEngines) {
    const aliases = Array.isArray(customSearchEngine.alias) ? customSearchEngine.alias : [customSearchEngine.alias]

    for (const alias of aliases) {
      const lowerAlias = alias.toLowerCase()
      const aliasPrefix = `${lowerAlias} `
      if (searchTerm.startsWith(aliasPrefix)) {
        const aliasTerm = searchTerm.slice(aliasPrefix.length)
        results.push(
          getCustomSearchEngineResult(
            aliasTerm,
            customSearchEngine.name,
            customSearchEngine.urlPrefix,
            customSearchEngine.blank,
            true,
          ),
        )
      }
    }
  }

  return results
}
