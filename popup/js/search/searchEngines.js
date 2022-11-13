import { cleanUpUrl } from '../helper/utils.js'

/**
 * Add results that use the configured search engines with the current search term
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
 * Adds one search result based for a custom search engine
 * This is used by the option `customSearchEngines`
 */
export function getCustomSearchEngineResult(searchTerm, name, urlPrefix) {
  let url
  if (urlPrefix.includes('$s')) {
    url = urlPrefix.replace('$s', encodeURIComponent(searchTerm))
  } else {
    url = urlPrefix + encodeURIComponent(searchTerm)
  }
  return {
    type: 'search',
    title: `${name}: "${searchTerm}"`,
    titleHighlighted: `${name}: "<mark>${searchTerm}</mark>"`,
    url: cleanUpUrl(url),
    urlHighlighted: cleanUpUrl(url),
    originalUrl: url,
    searchScore: ext.opts.scoreTitleWeight,
  }
}
