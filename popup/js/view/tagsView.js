//////////////////////////////////////////
// TAGS OVERVIEW PAGE VIEW              //
//////////////////////////////////////////

/**
 * Renders tags overview page (popup/tags.html)
 *
 * Displays:
 * - All unique tags extracted from bookmarks
 * - Count of bookmarks for each tag
 * - Clickable tag badges that link to filtered search results
 *
 * Template-based rendering for performance
 * Each tag is a clickable link that opens search with #tag filter
 */

import { getUniqueTags } from '../search/taxonomySearch.js'

export function loadTagsOverview() {
  const tags = getUniqueTags()
  const sortedTags = Object.keys(tags).sort()

  // Use template-based rendering for better performance
  const badgesHTML = sortedTags
    .map(
      (tag) =>
        `<a class="badge tags" href="./index.html#search/#${tag}" x-tag="${tag}">#${tag} <small>(${tags[tag].length})</small></a>`,
    )
    .join('')

  document.getElementById('tags-list').innerHTML = badgesHTML
}
