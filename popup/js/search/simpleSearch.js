/**
 * @file Implements the popup's precise/exact-match search strategy.
 *
 * Strategy:
 * - Perform case-insensitive substring matching across the precomputed `searchStringLower` field.
 * - Require all tokens to match (AND semantics) to keep results tightly focused.
 */

import { resolveSearchTargets } from './common.js'

/**
 * Memoize some state to avoid re-creating haystack and search instances.
 */
let state = {}

/**
 * Split a normalized search string into non-empty terms.
 *
 * The cached simple-search state stores these arrays so consecutive queries can
 * compare term prefixes without re-processing whitespace-only segments.
 *
 * @param {string} searchTerm - Normalized query string.
 * @returns {Array<string>} Non-empty search terms in input order.
 */
function tokenizeSearchTerm(searchTerm) {
  const rawTerms = searchTerm.split(' ')
  const terms = []
  for (let i = 0; i < rawTerms.length; i++) {
    if (rawTerms[i]) {
      terms.push(rawTerms[i])
    }
  }
  return terms
}

/**
 * Count how many leading terms two queries share.
 *
 * Example: `['foo']` and `['foo', 'bar']` share one leading term, so an
 * incremental search only needs to test the new suffix term `bar`.
 *
 * @param {Array<string>} prevTerms - Terms from the previous search.
 * @param {Array<string>} nextTerms - Terms from the current search.
 * @returns {number} Number of unchanged leading terms.
 */
function getSharedPrefixTermCount(prevTerms, nextTerms) {
  const max = prevTerms.length < nextTerms.length ? prevTerms.length : nextTerms.length
  let i = 0
  for (; i < max; i++) {
    if (prevTerms[i] !== nextTerms[i]) {
      break
    }
  }
  return i
}

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
 * Run an AND-based substring search within a single dataset and annotate matches.
 *
 * Matching uses the precomputed `searchStringLower` haystack on each item. The
 * function caches the previous query, term list, and matching indices per mode
 * so the common typing flow can avoid rescanning the full dataset:
 * - identical query: reuse cached indices directly
 * - extended query with same prefix: only test the new suffix terms against the
 *   already-matched subset
 * - changed/backspaced query: fall back to a full scan
 *
 * @param {string} searchTerm - Normalized query string.
 * @param {string} searchMode - Dataset key (`bookmarks`, `tabs`, `history`).
 * @param {Array<Object>} data - Search items for the active dataset.
 * @returns {Array<Object>} Matching items cloned with `searchApproach: 'precise'`.
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
      terms: [],
    }
  }

  // Return cached results if search term is identical
  if (s.searchTerm === searchTerm && s.idxs !== null) {
    return createResultObjects(s.data, s.idxs)
  }

  const haystack = s.haystack

  const prevSearchTerm = s.searchTerm
  const isIncremental = prevSearchTerm && searchTerm.startsWith(prevSearchTerm) && s.idxs !== null

  let idxs = isIncremental ? s.idxs : null

  const terms = tokenizeSearchTerm(searchTerm)
  const termLen = terms.length
  const prevTerms = s.terms
  const startTermIndex = isIncremental ? getSharedPrefixTermCount(prevTerms, terms) : 0

  // Start filtering
  for (let t = startTermIndex; t < termLen; t++) {
    const term = terms[t]

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
  s.terms = terms

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
