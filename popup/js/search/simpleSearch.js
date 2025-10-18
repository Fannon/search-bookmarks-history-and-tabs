/**
 * @file Implements the popup's precise search strategy with precomputed haystacks.
 * Uses AND-style substring matching and lightweight scoring for responsiveness.
 */

import { resolveSearchTargets } from './common.js'

/** Memoized simple-search state keyed by dataset. */
let state = {}

/**
 * Reset cached simple-search state when datasets or mode change.
 * @param {string} [searchMode]
 */
export function resetSimpleSearchState(searchMode) {
  if (searchMode) {
    state[searchMode] = undefined
  }
}

/**
 * Ensure each search entry caches a lower-cased search string.
 * @param {Array<Object>} data
 * @returns {Array<Object>}
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
 * @param {string} searchMode
 * @param {string} searchTerm
 * @returns {Array<Object>}
 */
export function simpleSearch(searchMode, searchTerm) {
  const targets = resolveSearchTargets(searchMode)
  if (!targets.length) {
    return [] // nothing, because search will be added later
  }

  if (targets.length === 1) {
    return simpleSearchWithScoring(searchTerm, targets[0])
  }

  const results = []
  for (const target of targets) {
    results.push(...simpleSearchWithScoring(searchTerm, target))
  }
  return results
}

/**
 * Run an AND-based substring search within a single dataset and assign scores.
 * @param {string} searchTerm
 * @param {string} searchMode
 * @returns {Array<Object>}
 */
function simpleSearchWithScoring(searchTerm, searchMode) {
  const data = ext.model[searchMode]
  if (!data.length) {
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
      // Cache the normalized search string to avoid repeated toLowerCase() calls
      const normalizedSearchString = entry.searchStringLower || entry.searchString.toLowerCase()
      if (normalizedSearchString.includes(term)) {
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
