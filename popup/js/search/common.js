//////////////////////////////////////////
// SEARCH                               //
//////////////////////////////////////////

import { getBrowserTabs } from '../helper/browserApi.js'
import { cleanUpUrl, printError } from '../helper/utils.js'
import { closeErrors } from '../initSearch.js'
import { renderSearchResults } from '../view/searchView.js'
import { fuzzySearch } from './fuzzySearch.js'
import { simpleSearch } from './simpleSearch.js'
import { searchTaxonomy } from './taxonomySearch.js'

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
const BASE_SCORE_KEYS = {
  bookmark: 'scoreBookmarkBase',
  tab: 'scoreTabBase',
  history: 'scoreHistoryBase',
  search: 'scoreSearchEngineBase',
  customSearch: 'scoreCustomSearchEngineBase',
  direct: 'scoreDirectUrlScore',
}
const withDefaultScore = (entry) => ({
  searchScore: 1,
  ...entry,
})

/**
 * Generates a random unique ID for on-demand search results
 */
function generateRandomId() {
  return Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36)
}

/**
 * This is the main search entry point.
 * It will decide which approaches and indexes to use.
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
 * Search with a with a specific approach and combine the results.
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
 * Calculates the final search item score for each result
 *
 * SCORING FLOW:
 * 1. Start with base score (depends on result type: bookmark=100, tab=70, history=45, etc.)
 * 2. Multiply by search quality score (from fuzzy/precise search algorithms, 0-1 range)
 * 3. Add field-specific bonuses:
 *    - Exact match bonuses (startsWith, equals, exact tag/folder match)
 *    - Includes bonuses (weighted by field: title=1.0, tag=0.7, url=0.6, folder=0.5)
 * 4. Add behavioral bonuses:
 *    - Visit frequency bonus (more visits = higher score, up to maximum)
 *    - Recent visit bonus (recently visited = higher score, up to maximum)
 *    - Date added bonus (recently added bookmarks score higher)
 * 5. Add custom user-defined bonus (e.g., "Bookmark Title +20 #tag")
 *
 * FIELD PRIORITY (for includes bonus):
 * - Title match (weight 1.0) - highest priority
 * - URL match (weight 0.6)
 * - Tag match (weight 0.7)
 * - Folder match (weight 0.5) - lowest priority
 * Only the FIRST matching field gets the bonus to avoid double-counting
 *
 * @param {Array} results - Search results to score
 * @param {string} searchTerm - The search query string
 * @returns {Array} Results with calculated scores
 */
export function calculateFinalScore(results, searchTerm) {
  const now = Date.now()
  const hasSearchTerm = Boolean(ext.model.searchTerm)
  const searchTermParts = hasSearchTerm ? searchTerm.split(' ') : []
  const hyphenatedSearchTerm = hasSearchTerm ? searchTermParts.join('-') : ''
  const tagTerms = hasSearchTerm ? searchTerm.split('#').join('').split(' ') : []
  const folderTerms = hasSearchTerm ? searchTerm.split('~').join('').split(' ') : []

  // Only check includes bonus if configured and search term is long enough
  const canCheckIncludes =
    hasSearchTerm && ext.opts.scoreExactIncludesBonus && searchTerm.length >= ext.opts.scoreExactIncludesBonusMinChars

  // Cache scoring options to avoid repeated property lookups
  const opts = ext.opts
  const {
    scoreExactStartsWithBonus,
    scoreExactEqualsBonus,
    scoreExactTagMatchBonus,
    scoreExactFolderMatchBonus,
    scoreExactIncludesBonus,
    scoreExactIncludesBonusMinChars,
    scoreVisitedBonusScore,
    scoreVisitedBonusScoreMaximum,
    scoreRecentBonusScoreMaximum,
    historyDaysAgo,
    scoreDateAddedBonusScoreMaximum,
    scoreDateAddedBonusScorePerDay,
    scoreCustomBonusScore,
    scoreTitleWeight,
    scoreUrlWeight,
    scoreTagWeight,
    scoreFolderWeight,
  } = opts

  for (let i = 0; i < results.length; i++) {
    const el = results[i]
    const baseKey = BASE_SCORE_KEYS[el.type]
    if (!baseKey) {
      throw new Error(`Search result type "${el.type}" not supported`)
    }

    // STEP 1: Start with base score (bookmark=100, tab=70, history=45, etc.)
    let score = opts[baseKey]

    // STEP 2: Multiply by search quality score (0-1 from fuzzy/precise search)
    // This reduces score if the match quality is poor
    const searchScoreMultiplier = el.searchScore || scoreTitleWeight
    score = score * searchScoreMultiplier

    if (hasSearchTerm) {
      // Pre-compute normalized field values for case-insensitive matching
      const lowerTitle = el.title ? el.title.toLowerCase().trim() : null
      const lowerUrl = el.url ? el.url.toLowerCase() : null
      const lowerTags = el.tags ? el.tags.toLowerCase() : null
      const lowerFolder = el.folder ? el.folder.toLowerCase() : null

      // Pre-compute normalized arrays for exact tag/folder matching
      const lowerTagValues = el.tagsArray ? el.tagsArray.map((tag) => tag.toLowerCase()) : []
      const lowerFolderValues = el.folderArray ? el.folderArray.map((folder) => folder.toLowerCase()) : []

      // STEP 3A: Exact match bonuses
      // Award bonus if title/URL starts with the exact search term
      if (scoreExactStartsWithBonus) {
        if (lowerTitle && lowerTitle.startsWith(searchTerm)) {
          score += scoreExactStartsWithBonus * scoreTitleWeight
        } else if (lowerUrl && lowerUrl.startsWith(hyphenatedSearchTerm)) {
          score += scoreExactStartsWithBonus * scoreUrlWeight
        }
      }

      // Award bonus if title exactly equals the search term
      if (scoreExactEqualsBonus && lowerTitle && lowerTitle === searchTerm) {
        score += scoreExactEqualsBonus * scoreTitleWeight
      }

      // Award bonus for each exact tag name match
      // Example: searching "react hooks" matches tags "#react" and "#hooks"
      if (scoreExactTagMatchBonus && el.tags && tagTerms.length) {
        const tagSet = new Set(lowerTagValues)
        for (const searchTag of tagTerms) {
          if (searchTag && tagSet.has(searchTag)) {
            score += scoreExactTagMatchBonus
          }
        }
      }

      // Award bonus for each exact folder name match
      // Example: searching "work projects" matches folders "~Work" and "~Projects"
      if (scoreExactFolderMatchBonus && el.folder && folderTerms.length) {
        const folderSet = new Set(lowerFolderValues)
        for (const searchFolder of folderTerms) {
          if (searchFolder && folderSet.has(searchFolder)) {
            score += scoreExactFolderMatchBonus
          }
        }
      }

      // STEP 3B: Includes bonuses (substring matching)
      // Check each word in the search query for matches in title/url/tags/folder
      // Priority order: title > url > tags > folder (only first match counts per term)
      if (canCheckIncludes) {
        for (const rawTerm of searchTermParts) {
          const term = rawTerm.trim()
          if (!term || term.length < scoreExactIncludesBonusMinChars) {
            continue
          }

          // URLs use hyphens instead of spaces, so normalize for matching
          const normalizedUrlTerm = term.replace(/\s+/g, '-')

          // Check fields in priority order - first match wins
          if (lowerTitle && lowerTitle.includes(term)) {
            score += scoreExactIncludesBonus * scoreTitleWeight
          } else if (lowerUrl && lowerUrl.includes(normalizedUrlTerm)) {
            score += scoreExactIncludesBonus * scoreUrlWeight
          } else if (lowerTags && lowerTags.includes(term)) {
            score += scoreExactIncludesBonus * scoreTagWeight
          } else if (lowerFolder && lowerFolder.includes(term)) {
            score += scoreExactIncludesBonus * scoreFolderWeight
          }
        }
      }
    }

    // STEP 4: Behavioral bonuses (usage patterns)

    // Award bonus based on visit frequency (more visits = higher score, up to cap)
    // Example: visited 50 times with 0.5 points per visit = +20 (capped at scoreVisitedBonusScoreMaximum)
    if (scoreVisitedBonusScore && el.visitCount) {
      score += Math.min(scoreVisitedBonusScoreMaximum, el.visitCount * scoreVisitedBonusScore)
    }

    // Award bonus based on recency of last visit (linear decay)
    // Recently visited items get max bonus, older items get less, oldest items get 0
    // Example: visited 1 hour ago within 7-day window = high bonus
    if (scoreRecentBonusScoreMaximum && el.lastVisitSecondsAgo != null) {
      const maxSeconds = historyDaysAgo * 24 * 60 * 60
      if (maxSeconds > 0 && el.lastVisitSecondsAgo >= 0) {
        // Calculate proportional bonus: 0 seconds ago = full bonus, maxSeconds ago = 0 bonus
        score += Math.max(0, (1 - el.lastVisitSecondsAgo / maxSeconds) * scoreRecentBonusScoreMaximum)
      } else if (el.lastVisitSecondsAgo === 0) {
        // Special case: visited in this exact moment gets maximum bonus
        score += scoreRecentBonusScoreMaximum
      }
    }

    // Award bonus for recently added bookmarks (linear decay over time)
    // Newer bookmarks score higher, older bookmarks score lower
    // Example: added today = max bonus, added 10 days ago = max - (10 * perDayPenalty)
    if (scoreDateAddedBonusScoreMaximum && scoreDateAddedBonusScorePerDay && el.dateAdded != null) {
      const daysAgo = (now - el.dateAdded) / 1000 / 60 / 60 / 24
      const penalty = daysAgo * scoreDateAddedBonusScorePerDay
      score += Math.max(0, scoreDateAddedBonusScoreMaximum - penalty)
    }

    // STEP 5: Add custom user-defined bonus score (e.g., "Title +20 #tag")
    // This allows users to manually prioritize specific bookmarks
    if (scoreCustomBonusScore && el.customBonusScore) {
      score += el.customBonusScore
    }

    // Set final calculated score on the result object
    el.score = score
  }

  return results
}

/**
 * Sorts the results according to some modes
 *
 * @param sortMode: "score" | "lastVisited"
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
 * If we don't have a search term yet (or not sufficiently long), display current tab related entries.
 *
 * Finds out if there are any bookmarks or history that match our current open URL.
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
 * Add results that use the configured search engines with the current search term
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
 * Adds one search result based for a custom search engine
 * This is used by the option `customSearchEngines`
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
