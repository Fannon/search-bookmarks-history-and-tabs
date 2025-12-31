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
  if (!state[searchMode]) {
    const haystack = new Array(dataLen)
    for (let i = 0; i < dataLen; i++) {
      haystack[i] = data[i].searchStringLower
    }
    state[searchMode] = {
      data: data,
      haystack: haystack,
      idxs: null, // null means "all indices" - avoids array allocation
      searchTerm: '',
    }
  }
  const s = state[searchMode]
  const haystack = s.haystack

  // Return cached results if search term is identical
  if (s.searchTerm === searchTerm && s.idxs !== null) {
    return createResultObjects(s.data, s.idxs)
  }

  // Invalidate cache if search term changed direction
  if (s.searchTerm && !searchTerm.startsWith(s.searchTerm)) {
    s.idxs = null
  }
  // Use existing indices or iterate all (null = all)
  let idxs = s.idxs

  const terms = searchTerm.split(' ')
  const sTerms = s.searchTerm ? s.searchTerm.split(' ') : []

  // Filtering (AND-logic)
  for (let t = 0; t < terms.length; t++) {
    const term = terms[t]
    if (!term) continue

    // Skip terms already satisfied by current idxs
    if (idxs !== null && sTerms[t] === term) {
      continue
    }

    const nextIdxs = []

    if (idxs === null) {
      for (let i = 0; i < dataLen; i++) {
        if (haystack[i].includes(term)) {
          nextIdxs.push(i)
        }
      }
    } else {
      for (let i = 0; i < idxs.length; i++) {
        const idx = idxs[i]
        if (haystack[idx].includes(term)) {
          nextIdxs.push(idx)
        }
      }
    }

    idxs = nextIdxs
    if (idxs.length === 0) break
  }

  s.idxs = idxs
  s.searchTerm = searchTerm

  // If idxs is still null, it means no valid search terms were provided (e.g. empty string)
  if (idxs === null || idxs.length === 0) {
    return []
  }

  return createResultObjects(s.data, idxs)
}

/**
 * Creates result objects for matched indices.
 */
function createResultObjects(data, idxs) {
  const count = idxs.length
  const results = new Array(count)
  for (let i = 0; i < count; i++) {
    const idx = idxs[i]
    const source = data[idx]
    // Direct object creation with spread is faster for subsequent property access
    // even if slightly slower for creation of large numbers of objects.
    results[i] = {
      ...source,
      searchScore: 1,
      searchApproach: 'precise',
    }
  }
  return results
}
