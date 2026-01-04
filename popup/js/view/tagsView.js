/**
 * @file Renders the tags overview in the popup.
 *
 * Responsibilities:
 * - Aggregate bookmark tags with frequency counts to build a browsable taxonomy.
 * - Render lightweight badge markup that links back to the main search filtered by the chosen tag.
 */

import { getUniqueTags } from '../search/taxonomySearch.js'
import { renderTaxonomy } from './taxonomyViewHelper.js'

/**
 * Render the tag chips and counts for the taxonomy overview.
 */
export function loadTagsOverview() {
  const tags = getUniqueTags()

  renderTaxonomy({
    containerId: 'tags-list',
    items: tags,
    marker: '#',
    itemClass: 'tags',
    attrName: 'x-tag',
    rerenderFn: loadTagsOverview,
    emptyStateHtml: `
      <div class="empty">
        <strong>No tags found</strong>
        <p>You haven't tagged any bookmarks yet. You can add tags in two ways:</p>
        <ol>
          <li><strong>Edit a bookmark:</strong> Search for a bookmark, click the edit icon (✎), and add tags in the tags field.</li>
          <li><strong>Inline tags:</strong> Append tags directly to a bookmark's title using the <code>#</code> prefix (e.g., <code>My Bookmark #work #tool</code>).</li>
        </ol>
        <p>
          <a href="https://github.com/Fannon/search-bookmarks-history-and-tabs#tags" target="_blank">
            Learn more about tagging →
          </a>
        </p>
      </div>
    `,
  })
}
