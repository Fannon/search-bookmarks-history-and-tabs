/**
 * @file Renders the folders overview in the popup.
 *
 * Responsibilities:
 * - Aggregate bookmark folders with frequency counts to build a browsable taxonomy.
 * - Render lightweight badge markup that links back to the main search filtered by the chosen folder.
 */

import { getUniqueFolders } from '../search/taxonomySearch.js'
import { renderTaxonomy } from './taxonomyViewHelper.js'

/**
 * Render the folder chips and counts for the taxonomy overview.
 */
export function loadFoldersOverview() {
  const folders = getUniqueFolders()

  renderTaxonomy({
    containerId: 'folders-list',
    items: folders,
    marker: '~',
    itemClass: 'folder',
    attrName: 'x-folder',
    rerenderFn: loadFoldersOverview,
    emptyStateHtml: `
      <div class="empty">
        <strong>No folders found</strong>
        <p>You don't have any bookmarks in folders yet. To see folders here:</p>
        <ol>
          <li>Organize your bookmarks into folders using your browser's bookmark manager.</li>
          <li>The folders will automatically appear here as navigable categories.</li>
        </ol>
      </div>
    `,
  })
}
