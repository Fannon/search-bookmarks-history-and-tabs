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
 */

import { escapeHtml } from '../helper/utils.js'
import { getUniqueTags } from '../search/taxonomySearch.js'

export function loadTagsOverview() {
  const tags = getUniqueTags()
  const sortedTags = Object.keys(tags).sort()

  const container = document.getElementById('tags-list')
  if (!container) {
    return
  }

  const badgesHTML = sortedTags
    .map((tag) => {
      const safeTag = escapeHtml(tag)
      return `<a class="badge tags" href="./index.html#search/#${safeTag}" x-tag="${safeTag}">#${safeTag} <small>(${tags[tag].length})</small></a>`
    })
    .join('')

  container.innerHTML = badgesHTML
}
