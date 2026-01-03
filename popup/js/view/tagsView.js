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
  const sortedTags = Object.keys(tags).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))

  const container = document.getElementById('tags-list')
  if (!container) {
    return
  }

  if (sortedTags.length === 0) {
    container.innerHTML = `
      <div class="empty">
        <strong>No tags found</strong>
        <p>You haven't tagged any bookmarks yet. You can add tags in two ways:</p>
        <ol>
          <li><strong>Edit a bookmark:</strong> Search for a bookmark, click the edit icon (✎), and add tags in the tags field.</li>
          <li><strong>Inline tags:</strong> Append tags directly to a bookmark's title using the <code>#</code> prefix (e.g., <code>My Bookmark #work #tool</code>).</li>
        </ol>
        <p>
          <a href="https://github.com/Fannon/search-tabs-bookmarks-and-history#tags" target="_blank">
            Learn more about tagging →
          </a>
        </p>
      </div>
    `
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
