/**
 * @file Renders the tags overview in the popup.
 *
 * Responsibilities:
 * - Aggregate bookmark tags with frequency counts to build a browsable taxonomy.
 * - Render lightweight badge markup that links back to the main search filtered by the chosen tag.
 * - Escape tag names before injecting into HTML to guard against malformed input.
 */

import { escapeHtml } from '../helper/utils.js'
import { getUniqueTags } from '../search/taxonomySearch.js'

/**
 * Render the tag chips and counts for the taxonomy overview.
 */
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
