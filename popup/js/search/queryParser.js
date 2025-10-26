/**
 * @file Query parsing utilities for detecting search modes and taxonomy markers.
 *
 * Responsibilities:
 * - Parse search mode prefixes (`h `, `b `, `t `, `s `) from query strings.
 * - Detect taxonomy markers (`#tag`, `~folder`) for specialized filtering.
 * - Normalize search terms by removing prefixes and markers.
 *
 * This module provides a clean separation of query parsing logic from search orchestration,
 * making it easier to test and maintain mode detection behavior.
 */

/**
 * Search mode prefix mappings.
 * Each entry maps a prefix string to its corresponding search mode.
 */
const SEARCH_MODE_PREFIXES = [
  ['h ', 'history'],
  ['b ', 'bookmarks'],
  ['t ', 'tabs'],
  ['s ', 'search']
]

/**
 * Taxonomy marker mappings.
 * Maps special characters to their corresponding taxonomy modes.
 */
const SEARCH_MODE_MARKERS = {
  '#': 'tags',
  '~': 'folders'
}

/**
 * Derive search mode prefixes or taxonomy markers from the raw query.
 *
 * This function analyzes the search term to detect:
 * 1. Mode prefixes (h/b/t/s followed by space)
 * 2. Taxonomy markers (# or ~ at the start)
 * 3. Falls back to 'all' mode if no special prefix/marker detected
 *
 * @param {string} searchTerm - Raw query string.
 * @returns {{mode: string, term: string}} Normalized mode and trimmed term.
 *
 * @example
 * resolveSearchMode('h example') // { mode: 'history', term: 'example' }
 * resolveSearchMode('#javascript') // { mode: 'tags', term: 'javascript' }
 * resolveSearchMode('normal search') // { mode: 'all', term: 'normal search' }
 */
export function resolveSearchMode(searchTerm) {
  let mode = 'all'
  let term = searchTerm

  // Check for explicit mode prefixes first
  for (const [prefix, candidate] of SEARCH_MODE_PREFIXES) {
    if (term.startsWith(prefix)) {
      mode = candidate
      term = term.slice(prefix.length)
      return { mode, term }
    }
  }

  // Check for taxonomy markers (# or ~) at the start
  const marker = SEARCH_MODE_MARKERS[term[0]]
  if (marker) {
    mode = marker
    term = term.slice(1)
  }

  return { mode, term }
}
