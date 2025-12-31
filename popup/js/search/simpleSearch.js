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
  const dataLen = originalData.length

  // Use existing indices or iterate all (null = all)
  let idxs = s.idxs

  const terms = searchTerm.toLowerCase().split(' ')

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

  if (idxs.length === 0) {
    return []
  }

  const results = new Array(idxs.length)
  for (let i = 0; i < idxs.length; i++) {
    const idx = idxs[i]
    // Use Object.create for fast prototype-based shallow clone
    const result = Object.create(originalData[idx])
    result.searchScore = 1
    result.searchApproach = 'precise'
    results[i] = result
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
