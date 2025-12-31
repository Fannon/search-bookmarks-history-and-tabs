/**
 * @file Implements the popup's precise/exact-match search strategy.
 *
 * Strategy:
 * - Perform case-insensitive substring matching across the precomputed `searchString` field.
 * - Require all tokens to match (AND semantics) to keep results tightly focused.
 */

import { escapeHtml, escapeRegex } from '../helper/utils.js'
import { resolveSearchTargets } from './common.js'

/**
 * Memoize some state to avoid re-creating haystack and search instances.
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
 * Prepare search data with pre-computed lowercase strings and pre-escaped parts.
 *
 * @param {Array<Object>} data - Items to prepare.
 * @returns {Object} Prepared data structure.
 */
function prepareSearchData(data) {
  const len = data.length
  const haystack = new Array(len)

  for (let i = 0; i < len; i++) {
    const entry = data[i]
    // Cache lowercase version for matching
    haystack[i] = entry.searchStringLower || entry.searchString.toLowerCase()
  }

  return {
    data,
    haystack,
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

  // Initialize or retrieve cached state
  if (!state[searchMode]) {
    state[searchMode] = {
      prepared: prepareSearchData(data),
      idxs: null,
      searchTerm: '',
    }
  }
  const s = state[searchMode]

  // Only reset filtering state, keep prepared strings
  if (s.searchTerm && !searchTerm.startsWith(s.searchTerm)) {
    s.idxs = null
  }

  const { data: originalData, haystack } = s.prepared

  // Initialize indices if needed
  let idxs = s.idxs
  if (!idxs) {
    idxs = []
    for (let i = 0; i < haystack.length; i++) {
      idxs.push(i)
    }
  }

  if (idxs.length === 0) {
    return []
  }

  const terms = searchTerm.toLowerCase().split(' ')

  // Filtering (AND-logic)
  for (let t = 0; t < terms.length; t++) {
    const term = terms[t]
    if (!term) continue

    const nextIdxs = []
    for (let i = 0; i < idxs.length; i++) {
      const idx = idxs[i]
      if (haystack[idx].indexOf(term) !== -1) {
        nextIdxs.push(idx)
      }
    }
    idxs = nextIdxs
    if (idxs.length === 0) break
  }

  // Cache filtered state
  s.idxs = idxs
  s.searchTerm = searchTerm

  if (idxs.length === 0) {
    return []
  }

  const results = new Array(idxs.length)
  for (let i = 0; i < idxs.length; i++) {
    const idx = idxs[i]
    results[i] = {
      ...originalData[idx],
      searchScore: 1,
      searchApproach: 'precise',
    }
  }

  return results
}

/**
 * Highlighting stage for precise search matches.
 * Should be called after results are ranked and truncated for performance.
 *
 * @param {Array<Object>} results - The subset of results to highlight.
 * @param {string} searchTerm - The query terms used for matching.
 * @returns {Array<Object>} Results with `highlightedTitle` and `highlightedUrl`.
 */
export function highlightSimpleSearch(results, searchTerm) {
  if (!results.length) {
    return results
  }

  const terms = searchTerm ? searchTerm.toLowerCase().split(' ') : []
  const filteredTerms = terms.filter(Boolean)
  let highlightRegex = null

  if (filteredTerms.length > 0) {
    const escapedTerms = []
    for (let i = 0; i < filteredTerms.length; i++) {
      escapedTerms.push(escapeRegex(escapeHtml(filteredTerms[i])))
    }
    escapedTerms.sort((a, b) => b.length - a.length)
    highlightRegex = new RegExp(`(${escapedTerms.join('|')})`, 'gi')
  }

  for (let i = 0; i < results.length; i++) {
    const entry = results[i]
    const searchStr = entry.searchString
    // Split on '¦' to separate title¦url¦tags¦folder format
    // Only take first two parts (title and url), ignoring tags and folders
    const parts = searchStr.split('¦')
    const title = parts[0] || ''
    const url = parts[1] || ''

    const escapedTitle = escapeHtml(title)
    const escapedUrl = url ? escapeHtml(url) : ''

    entry.highlightedTitle = highlightRegex ? escapedTitle.replace(highlightRegex, '<mark>$1</mark>') : escapedTitle
    entry.highlightedUrl = highlightRegex ? escapedUrl.replace(highlightRegex, '<mark>$1</mark>') : escapedUrl
  }

  return results
}
