/**
 * @file Utilities for parsing and splitting taxonomy markers and search terms.
 *
 * Responsibilities:
 * - Extract tag (#) and folder (~) terms from search queries and bookmark titles.
 * - Provide consistent term splitting logic across scoring and search modules.
 * - Handle edge cases like empty terms, leading/trailing whitespace, and multiple markers.
 */

/**
 * Parse taxonomy terms from text with a specific marker.
 *
 * Splits text on the taxonomy marker and returns an array of cleaned terms.
 * The first element (before any marker) is excluded from the result.
 *
 * Examples:
 * - parseTaxonomyTerms("#react #node", "#") → ["react", "node"]
 * - parseTaxonomyTerms("~Work ~Projects", "~") → ["Work", "Projects"]
 * - parseTaxonomyTerms("Title #tag1 #tag2", "#") → ["tag1", "tag2"]
 *
 * @param {string} text - Text containing taxonomy markers
 * @param {string} marker - Taxonomy marker character ('#' or '~')
 * @returns {Array<string>} Array of cleaned taxonomy terms
 */
export function parseTaxonomyTerms(text, marker = '#') {
  if (!text) {
    return []
  }

  return text
    .split(marker)
    .slice(1) // Skip first element before any marker
    .map((term) => term.trim())
    .filter(Boolean) // Remove empty strings
}

/**
 * Split search terms from a search query string.
 *
 * Splits on spaces and returns an array of cleaned terms.
 * Filters out empty strings and trims whitespace.
 *
 * Examples:
 * - splitSearchTerms("react hooks") → ["react", "hooks"]
 * - splitSearchTerms("  foo   bar  ") → ["foo", "bar"]
 * - splitSearchTerms("") → []
 *
 * @param {string} searchTerm - Search query string
 * @returns {Array<string>} Array of cleaned search terms
 */
export function splitSearchTerms(searchTerm) {
  if (!searchTerm) {
    return []
  }

  return searchTerm
    .split(' ')
    .map((term) => term.trim())
    .filter(Boolean) // Remove empty strings
}

/**
 * Extract terms from a search query after removing taxonomy markers.
 *
 * Useful for extracting tag or folder search terms from queries like:
 * - "search #react #node" → ["search", "react", "node"]
 * - "foo ~Work ~Projects" → ["foo", "Work", "Projects"]
 *
 * @param {string} searchTerm - Search query string
 * @param {string} marker - Taxonomy marker to remove ('#' or '~')
 * @returns {Array<string>} Array of cleaned terms
 */
export function extractTermsWithoutMarker(searchTerm, marker = '#') {
  if (!searchTerm) {
    return []
  }

  return searchTerm
    .split(marker)
    .join('')
    .split(' ')
    .map((term) => term.trim())
    .filter(Boolean) // Remove empty strings
}
