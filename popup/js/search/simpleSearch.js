/**
 * @file Implements the popup's precise/exact-match search strategy.
 *
 * Strategy:
 * - Perform case-insensitive substring matching across the precomputed `searchString` field.
 * - Require all tokens to match (AND semantics) to keep results tightly focused.
 */

import { resolveSearchTargets } from './common.js'

/**
 * Memoize some state to avoid re-creating haystack and search instances.
 */
let state = {}

/**
 * Reset cached simple search state when datasets or mode change.
 *
 * @param {string} [searchMode] - Optional mode to reset; resets all when omitted.
 */
export function resetSimpleSearchState(searchMode) {
  if (searchMode) {
    state[searchMode] = undefined
  } else {
    state = {}
  }
}

/**
 * Execute a precise search across the datasets associated with a mode.
 */
export function simpleSearch(searchMode, searchTerm, data) {
  const targets = resolveSearchTargets(searchMode)
  if (!targets.length) {
    return []
  }

  if (targets.length === 1) {
    return simpleSearchWithScoring(searchTerm, targets[0], data[targets[0]])
  }

  const results = []
  for (let i = 0; i < targets.length; i++) {
    results.push(...simpleSearchWithScoring(searchTerm, targets[i], data[targets[i]]))
  }
  return results
}

/**
 * Run an AND-based substring search within a single dataset and assign scores.
 */
function simpleSearchWithScoring(searchTerm, searchMode, data) {
  if (!data || !data.length) {
    return []
  }

  const dataLen = data.length

  // Initialize or retrieve cached state
  // No haystack duplication - we use data[i].searchStringLower directly
  if (!state[searchMode]) {
    state[searchMode] = {
      data: data,
      idxs: null, // null means "all indices" - avoids array allocation
      searchTerm: '',
    }
  }
  const s = state[searchMode]

  // Only reset filtering state if search term changed direction
  if (s.searchTerm && !searchTerm.startsWith(s.searchTerm)) {
    s.idxs = null
  }

  const originalData = s.data

  // Use existing indices or iterate all (null = all)
  let idxs = s.idxs

  // Split once and reuse - searchTerm is already lowercase from normalizeSearchTerm
  const terms = searchTerm.split(' ')

  // Filtering (AND-logic)
  for (let t = 0; t < terms.length; t++) {
    const term = terms[t]
    if (!term) continue

    const nextIdxs = []

    if (idxs === null) {
      // First pass: iterate all data directly (no index array allocation)
      for (let i = 0; i < dataLen; i++) {
        if (originalData[i].searchStringLower.indexOf(term) !== -1) {
          nextIdxs.push(i)
        }
      }
    } else {
      // Subsequent passes: filter existing indices
      for (let i = 0; i < idxs.length; i++) {
        const idx = idxs[i]
        if (originalData[idx].searchStringLower.indexOf(term) !== -1) {
          nextIdxs.push(idx)
        }
      }
    }

    idxs = nextIdxs
    if (idxs.length === 0) break
  }

  // Cache filtered state
  s.idxs = idxs
  s.searchTerm = searchTerm

  // If idxs is still null, it means no valid search terms were provided (e.g. empty string)
  if (idxs === null || idxs.length === 0) {
    return []
  }

  // Inline object creation instead of Object.create for better performance
  const results = new Array(idxs.length)
  for (let i = 0; i < idxs.length; i++) {
    const idx = idxs[i]
    const source = originalData[idx]
    // Direct object creation with spread is faster than Object.create for this use case
    results[i] = {
      ...source,
      searchScore: 1,
      searchApproach: 'precise',
    }
  }

  return results
}
