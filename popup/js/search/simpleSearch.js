/**
 * @file Implements the popup's precise/exact-match search strategy.
 *
 * Strategy:
 * - Perform case-insensitive substring matching across the precomputed `searchString` field.
 * - Require all tokens to match (AND semantics) to keep results tightly focused.
 * - Skip fuzzy tolerances or extra scoring logic so exact phrases stay lightning fast.
 *
 * Scoring pipeline:
 * - Every match carries a `searchScore` of 1 before flowing into `scoring.js` for final ranking.
 * - Prepares highlight metadata for the view without additional processing overhead.
 *
 * Memoisation:
 * - Cache pre-lowered haystacks per mode (bookmarks, tabs, history) for reuse across repeated queries.
 * - Reset caches when the search dataset or active mode changes to avoid stale results.
 */

import { resolveSearchTargets } from './common.js'

/**
 * Memoize some state, to avoid re-creating haystack and fuzzy search instances.
 */
const state = {}

/**
 * Reset cached simple search state when datasets or mode change.
 *
 * @param {string} [searchMode] - Optional mode to reset; resets all when omitted.
 */
export function resetSimpleSearchState(searchMode) {
  if (searchMode) {
    state[searchMode] = undefined
  } else {
    for (const key in state) {
      delete state[key]
    }
  }
}

/**
 * Ensure each search entry caches a lower-cased search string.
 *
 * @param {Array<Object>} data - Items to prepare.
 * @returns {Array<Object>} Normalised entries.
 */
function prepareSearchData(data) {
  return data.map((entry) => {
    if (!entry.searchStringLower) {
      entry.searchStringLower = entry.searchString.toLowerCase()
    }
    return entry
  })
}

/**
 * Execute a precise search across the datasets associated with a mode.
 *
 * @param {string} searchMode - Active search mode.
 * @param {string} searchTerm - Query string.
 * @returns {Array<Object>} Matching entries with `searchScore`.
 */
export function simpleSearch(searchMode, searchTerm, data) {
  const targets = resolveSearchTargets(searchMode)
  if (!targets.length) {
    return [] // nothing, because search will be added later
  }

  if (targets.length === 1) {
    return simpleSearchWithScoring(searchTerm, targets[0], data[targets[0]])
  }

  const results = []
  for (const target of targets) {
    results.push(...simpleSearchWithScoring(searchTerm, target, data[target]))
  }
  return results
}

/**
 * Run an AND-based substring search within a single dataset and assign scores.
 *
 * @param {string} searchTerm - Query string.
 * @param {string} searchMode - Dataset key inside `ext.model`.
 * @param {Array<Object>} data - The dataset to search.
 * @returns {Array<Object>} Filtered entries with `searchScore: 1`.
 */
function simpleSearchWithScoring(searchTerm, searchMode, data) {
  if (!data || !data.length) {
    return [] // early return -> no data to search
  }

  if (!state[searchMode]) {
    state[searchMode] = {
      cachedData: prepareSearchData(data),
    }
  }
  const s = state[searchMode]

  // Invalidate s.cachedData if the new search term is not just an extension of the last one
  if (s.searchTerm && !searchTerm.startsWith(s.searchTerm)) {
    s.cachedData = prepareSearchData(data)
  }

  if (!s.cachedData.length) {
    return [] // early return -> no data left to search
  }

  const searchTermArray = searchTerm.split(' ')

  for (const term of searchTermArray) {
    const localResults = []
    for (const entry of s.cachedData) {
      // searchStringLower is always pre-computed during prepareSearchData
      if (entry.searchStringLower.includes(term)) {
        localResults.push({
          ...entry,
          searchScore: 1,
          searchApproach: 'precise',
        })
      }
    }
    s.cachedData = localResults // reduce cachedData set -> improves performance
    if (!s.cachedData.length) {
      break
    }
  }

  s.searchTerm = searchTerm
  return s.cachedData
}
