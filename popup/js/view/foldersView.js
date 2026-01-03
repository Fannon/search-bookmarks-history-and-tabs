/**
 * @file Renders the folders overview in the popup.
 *
 * Responsibilities:
 * - Aggregate bookmark folders into sorted badge lists with usage counts.
 * - Generate navigation links that jump back into the main search view filtered by a folder hash.
 * - Mirror the tag overview experience so taxonomy exploration stays consistent.
 * - Escape folder names before rendering so unusual characters cannot break markup.
 */

import { escapeHtml } from '../helper/utils.js'
import { getUniqueFolders } from '../search/taxonomySearch.js'

/**
 * Render folder badges with counts for the taxonomy overview.
 */
export function loadFoldersOverview() {
  const folders = getUniqueFolders()
  const sortMode = localStorage.getItem('taxonomySortMode') || 'alpha'

  let sortedFolders = []
  if (sortMode === 'count') {
    sortedFolders = Object.keys(folders).sort((a, b) => {
      const countA = folders[a].length
      const countB = folders[b].length
      if (countA !== countB) {
        return countB - countA // Higher count first
      }
      return a.localeCompare(b, undefined, { sensitivity: 'base' })
    })
  } else {
    sortedFolders = Object.keys(folders).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  }

  const container = document.getElementById('folders-list')
  if (!container) {
    return
  }

  if (sortedFolders.length === 0) {
    container.innerHTML = `
      <div class="empty">
        <strong>No folders found</strong>
        <p>You don't have any bookmarks in folders yet. To see folders here:</p>
        <ol>
          <li>Organize your bookmarks into folders using your browser's bookmark manager.</li>
          <li>The folders will automatically appear here as navigable categories.</li>
        </ol>
      </div>
    `
    return
  }

  const badgesHTML = sortedFolders
    .map((folderName) => {
      const safeName = escapeHtml(folderName)
      return `<a class="badge folder" href="./index.html#search/~${safeName}" x-folder="${safeName}">~${safeName} <small>(${folders[folderName].length})</small></a>`
    })
    .join('')

  // Add the list and a sort toggle button at the bottom
  const sortLabel = sortMode === 'alpha' ? 'SORT BY COUNT' : 'SORT ALPHABETICALLY'
  const newSortMode = sortMode === 'alpha' ? 'count' : 'alpha'

  // Icon 1: Direction indicator (Descending for count, Ascending for alpha)
  const sortDirectionIcon =
    sortMode === 'alpha'
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="icon-tabler-sort-descending"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 6l9 0" /><path d="M4 10l7 0" /><path d="M4 14l3 0" /><path d="M4 18l3 0" /><path d="M17 15l3 3l3 -3" /><path d="M20 6l0 12" /></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="icon-tabler-sort-ascending"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 6l7 0" /><path d="M4 10l7 0" /><path d="M4 14l3 0" /><path d="M17 9l3 -3l3 3" /><path d="M20 6l0 12" /></svg>`

  // Icon 2: Type indicator (123 or ABC)
  const sortTypeIcon =
    sortMode === 'alpha'
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="icon-tabler-123"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 10l2 -2v8" /><path d="M9 8h3a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-2a1 1 0 0 0 -1 1v2a1 1 0 0 0 1 1h3" /><path d="M17 8h2.5a1.5 1.5 0 0 1 1.5 1.5v1a1.5 1.5 0 0 1 -1.5 1.5h-1.5h1.5a1.5 1.5 0 0 1 1.5 1.5v1a1.5 1.5 0 0 1 -1.5 1.5h-2.5" /></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="icon-tabler-abc"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 16v-6a2 2 0 1 1 4 0v6" /><path d="M3 13h4" /><path d="M10 8v6a2 2 0 1 0 4 0v-1a2 2 0 1 0 -4 0v1" /><path d="M20.732 12a2 2 0 0 0 -3.732 1v1a2 2 0 0 0 3.726 1" /></svg>`

  container.innerHTML = `
    ${badgesHTML}
    <div class="taxonomy-footer">
      <button id="sort-toggle" class="button" data-sort="${newSortMode}" title="${sortLabel}">
        ${sortDirectionIcon}
        ${sortTypeIcon}
        ${sortLabel}
      </button>
    </div>
  `

  // Add event listener for the sort toggle
  const sortToggle = document.getElementById('sort-toggle')
  if (sortToggle) {
    sortToggle.addEventListener('click', () => {
      localStorage.setItem('taxonomySortMode', sortToggle.dataset.sort)
      loadFoldersOverview()
    })
  }
}
