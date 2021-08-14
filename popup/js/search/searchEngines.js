import { cleanUpUrl } from "../helper/utils.js";

/**
 * Add results that use the configured search engines with the current search term
 */
export function addSearchEngines(searchTerm) {
  const results = [];
  if (ext.opts.searchEngines.enabled) {
    for (const searchEngine of ext.opts.searchEngines.choices) {
      const url = searchEngine.urlPrefix + encodeURIComponent(searchTerm);
      results.push({
        type: "search",
        title: `${searchEngine.name}: "${searchTerm}"`,
        url: cleanUpUrl(url),
        originalUrl: url,
        searchScore: ext.opts.score.titleWeight,
      });
    }
  }
  return results;
}
