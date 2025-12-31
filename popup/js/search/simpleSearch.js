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
    // Optimization: Create a flat haystack array of strings.
    // Iterating over a flat array of strings is significantly faster than
    // accessing properties on an array of objects in many JS engines.
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

  // Optimization: If search term is exactly the same, return cached results (as new objects)
  if (s.searchTerm === searchTerm && s.idxs !== null) {
    return createResultObjects(s.data, s.idxs)
  }

  // Only reset filtering state if search term changed direction
  if (s.searchTerm && !searchTerm.startsWith(s.searchTerm)) {
    s.idxs = null
  }

  // Use existing indices or iterate all (null = all)
  let idxs = s.idxs

  // Split once and reuse - searchTerm is already lowercase from normalizeSearchTerm
  const terms = searchTerm.split(' ')

  // Filtering (AND-logic)
  for (let t = 0; t < terms.length; t++) {
    const term = terms[t]
    if (!term) continue

    // Optimization: If this is the first term of an extended search ("abc" -> "abc def"),
    // and s.idxs already contains results for the first part, we can skip the first pass.
    if (t === 0 && idxs !== null && s.searchTerm.split(' ')[0] === term) {
      continue
    }

    const nextIdxs = []

    if (idxs === null) {
      // First pass: iterate all data directly (no index array allocation)
      for (let i = 0; i < dataLen; i++) {
        // .includes() is often slightly more optimized than .indexOf() !== -1 for boolean checks
        if (haystack[i].includes(term)) {
          nextIdxs.push(i)
        }
      }
    } else {
      // Subsequent passes: filter existing indices
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

  // Cache filtered state
  s.idxs = idxs
  s.searchTerm = searchTerm

  // If idxs is still null, it means no valid search terms were provided (e.g. empty string)
  if (idxs === null || idxs.length === 0) {
    return []
  }

  return createResultObjects(s.data, idxs)
}

/**
 * Creates the result objects for the matched indices.
 * Separated from search logic for clarity and potential future reuse.
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
