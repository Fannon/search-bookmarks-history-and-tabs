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
  let s = state[searchMode]
  if (!s) {
    // Projecting the haystack once saves property lookups in the hot loop
    const haystack = new Array(dataLen)
    for (let i = 0; i < dataLen; i++) {
      haystack[i] = data[i].searchStringLower
    }
    s = state[searchMode] = {
      data: data,
      haystack: haystack,
      idxs: null, // null means "all indices" - avoids array allocation
      searchTerm: '',
    }
  }

  // Return cached results if search term is identical
  if (s.searchTerm === searchTerm && s.idxs !== null) {
    return createResultObjects(s.data, s.idxs)
  }

  const haystack = s.haystack

  // Determine if we can use incremental search from previous indices
  // An incremental search is valid when:
  // 1. We have a previous search term
  // 2. The new search term starts with the previous search term
  // 3. We have cached indices from the previous search
  const prevSearchTerm = s.searchTerm
  const isIncremental = prevSearchTerm && searchTerm.startsWith(prevSearchTerm) && s.idxs !== null

  let idxs = isIncremental ? s.idxs : null

  // For incremental search, we only need to filter by the NEW characters added
  // For non-incremental, we filter by all terms
  const terms = searchTerm.split(' ')
  const termLen = terms.length

  // Start filtering
  for (let t = 0; t < termLen; t++) {
    const term = terms[t]
    if (!term) continue // Skip empty terms

    const nextIdxs = []

    if (idxs === null) {
      // First-pass: search everything
      for (let i = 0; i < dataLen; i++) {
        if (haystack[i].includes(term)) {
          nextIdxs.push(i)
        }
      }
    } else {
      // Subsequent passes: filter existing indices
      const currentIdxLen = idxs.length
      for (let i = 0; i < currentIdxLen; i++) {
        const idx = idxs[i]
        if (haystack[idx].includes(term)) {
          nextIdxs.push(idx)
        }
      }
    }

    idxs = nextIdxs
    if (idxs.length === 0) break
  }

  // Update cached state
  s.idxs = idxs
  s.searchTerm = searchTerm

  // If idxs is still null (no terms provided) or empty, return no results
  if (!idxs || idxs.length === 0) {
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
    // Spread is currently the fastest way in V8 to clone and extend objects
    // for subsequent property access (which scoring and rendering do heavily).
    results[i] = {
      ...data[idxs[i]],
      searchApproach: 'precise',
    }
  }
  return results
}
