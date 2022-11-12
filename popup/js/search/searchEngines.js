import { cleanUpUrl } from '../helper/utils.js'

/**
 * Add results that use the configured search engines with the current search term
 */
export function addSearchEngines(searchTerm) {
  const results = []
  if (ext.opts.enableSearchEngines) {
    for (const searchEngine of ext.opts.searchEngineChoices) {
      const url = searchEngine.urlPrefix + encodeURIComponent(searchTerm)
      results.push({
        type: 'search',
        title: `${searchEngine.name}: "${searchTerm}"`,
        url: cleanUpUrl(url),
        originalUrl: url,
        searchScore: ext.opts.scoreTitleWeight,
      })
    }
  }
  return results
}

/**
 * Adds one search result based for a custom search engine
 * This is used by the option `customSearchEngines`
 */
export function addCustomSearchEngineResult(searchTerm, name, urlPrefix) {
  const url = urlPrefix + encodeURIComponent(searchTerm)
  return [
    {
      type: 'search',
      title: `${name}: "${searchTerm}"`,
      titleHighlighted: `${name}: "${searchTerm}"`,
      url: cleanUpUrl(url),
      originalUrl: url,
      searchScore: ext.opts.scoreTitleWeight,
    },
  ]
}
