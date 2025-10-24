/**
 * @file Search engine result generation and custom alias handling.
 *
 * Responsibilities:
 * - Create search engine result entries for external searches (Google, DuckDuckGo, etc.).
 * - Handle custom search engine aliases (e.g., `yt cats` → YouTube search).
 * - Generate synthetic result objects compatible with the scoring system.
 *
 * This module centralizes all search engine-related logic, making it easy to add
 * new search engines or modify alias behavior without touching orchestration code.
 */

import { cleanUpUrl, generateRandomId } from '../helper/utils.js'

/**
 * Build a single search result entry that targets a custom search engine.
 *
 * This function constructs a search result object that opens a search engine
 * with the user's query. It supports URL templates with `$s` placeholders.
 *
 * @param {string} searchTerm - Query string to substitute.
 * @param {string} name - Display label for the search engine.
 * @param {string} urlPrefix - Base URL (optionally containing `$s` placeholder).
 * @param {string} [urlBlank] - Optional blank-state URL when no term is provided.
 * @param {boolean} [custom=false] - Flag to mark user-defined engines.
 * @returns {Object} Search result object compatible with scoring.
 *
 * @example
 * getCustomSearchEngineResult('javascript', 'Google', 'https://google.com/search?q=$s')
 * // Returns: { type: 'search', title: 'Google: "javascript"', url: '...', ... }
 */
export function getCustomSearchEngineResult(searchTerm, name, urlPrefix, urlBlank, custom) {
  let url
  let title = `${name}: "${searchTerm}"`
  let titleHighlighted = `${name}: "<mark>${searchTerm}</mark>"`

  if (urlBlank && !searchTerm.trim()) {
    url = urlBlank
    title = name
    titleHighlighted = name
  } else if (urlPrefix.includes('$s')) {
    url = urlPrefix.replace('$s', encodeURIComponent(searchTerm))
  } else {
    url = urlPrefix + encodeURIComponent(searchTerm)
  }

  return {
    type: custom ? 'customSearch' : 'search',
    title: title,
    titleHighlighted: titleHighlighted,
    url: cleanUpUrl(url),
    urlHighlighted: cleanUpUrl(url),
    originalUrl: url,
    originalId: generateRandomId(),
    searchScore: 1,
  }
}

/**
 * Create external search engine entries for the current query.
 *
 * Generates result entries for all enabled search engines configured in options.
 * These appear at the bottom of search results and allow users to search externally.
 *
 * @param {string} searchTerm - Query string from the input box.
 * @returns {Array} Search engine result objects.
 *
 * @example
 * // With ext.opts.searchEngineChoices = [{ name: 'Google', urlPrefix: '...' }]
 * addSearchEngines('cats')
 * // Returns: [{ type: 'search', title: 'Google: "cats"', ... }]
 */
export function addSearchEngines(searchTerm) {
  const results = []
  if (ext.opts.enableSearchEngines) {
    for (const searchEngine of ext.opts.searchEngineChoices) {
      results.push(getCustomSearchEngineResult(searchTerm, searchEngine.name, searchEngine.urlPrefix))
    }
  }
  return results
}

/**
 * Resolve alias-triggered custom search engine results when the query starts with an alias.
 *
 * This function checks if the search term begins with a registered custom alias
 * (e.g., `yt cats` for YouTube). If found, it extracts the term after the alias
 * and generates a custom search result.
 *
 * @param {string} searchTerm - Raw search query.
 * @returns {Array} Matching custom search engine entries.
 *
 * @example
 * // With customSearchEngines = [{ alias: 'yt', name: 'YouTube', urlPrefix: '...' }]
 * collectCustomSearchAliasResults('yt cats')
 * // Returns: [{ type: 'customSearch', title: 'YouTube: "cats"', ... }]
 */
export function collectCustomSearchAliasResults(searchTerm) {
  if (!ext.opts.customSearchEngines) {
    return []
  }

  const results = []
  for (const customSearchEngine of ext.opts.customSearchEngines) {
    const aliases = Array.isArray(customSearchEngine.alias) ? customSearchEngine.alias : [customSearchEngine.alias]

    for (const alias of aliases) {
      const lowerAlias = alias.toLowerCase()
      const aliasPrefix = `${lowerAlias} `
      if (searchTerm.startsWith(aliasPrefix)) {
        const aliasTerm = searchTerm.slice(aliasPrefix.length)
        results.push(
          getCustomSearchEngineResult(
            aliasTerm,
            customSearchEngine.name,
            customSearchEngine.urlPrefix,
            customSearchEngine.blank,
            true,
          ),
        )
      }
    }
  }

  return results
}
