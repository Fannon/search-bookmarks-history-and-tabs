/**
 * @file Renders the groups overview in the popup.
 *
 * Responsibilities:
 * - Aggregate tab groups with frequency counts to build a browsable taxonomy.
 * - Render lightweight badge markup that links back to the main search filtered by the chosen group.
 * - Escape group names before injecting into HTML to guard against malformed input.
 * - Display helpful messages when permission is missing or no groups exist.
 */

import { browserApi } from '../helper/browserApi.js'
import { escapeHtml } from '../helper/utils.js'
import { getUniqueGroups } from '../search/taxonomySearch.js'

/**
 * Render the group chips and counts for the taxonomy overview.
 */
export function loadGroupsOverview() {
  const container = document.getElementById('groups-list')
  if (!container) {
    return
  }

  // Check if the tabGroups API is available
  if (!browserApi.tabGroups?.query) {
    container.innerHTML = `
      <div class="empty">
        <strong><span class="warning-prefix">WARNING:</span> Tab Groups permission not available</strong>
        <p>This feature requires the <code>tabGroups</code> permission which is not currently active.</p>
        <p><strong>To enable:</strong></p>
        <ol>
          <li>Go to your browser's extension management page (e.g. <code>chrome://extensions</code> or <code>edge://extensions</code>)</li>
          <li>Find this extension and click the reload button (↻)</li>
          <li>Reopen this popup</li>
        </ol>
        <p><em>Note: This feature is only supported in browsers that implement the Tab Groups API. Firefox does not currently support this API.</em></p>
      </div>
    `
    return
  }

  const groups = getUniqueGroups()
  const sortMode = localStorage.getItem('taxonomySortMode') || 'alpha'

  let sortedGroups = []
  if (sortMode === 'count') {
    sortedGroups = Object.keys(groups).sort((a, b) => {
      const countA = groups[a].length
      const countB = groups[b].length
      if (countA !== countB) {
        return countB - countA // Higher count first
      }
      return a.localeCompare(b, undefined, { sensitivity: 'base' })
    })
  } else {
    sortedGroups = Object.keys(groups).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  }

  if (sortedGroups.length === 0) {
    container.innerHTML = `
      <div class="empty">
        <strong>No tab groups found</strong>
        <p>You don't have any named tab groups. To use this feature:</p>
        <ol>
          <li>Right-click on a tab in your browser</li>
          <li>Select <strong>"Add tab to new group"</strong></li>
          <li>Right-click the group dot and <strong>name your group</strong></li>
        </ol>
        <p>
          <a href="https://support.google.com/chrome/answer/2391819" target="_blank">
            Learn more about Tab Groups (Chrome) →
          </a>
        </p>
      </div>
    `
    return
  }

  const badgesHTML = sortedGroups
    .map((group) => {
      const safeGroup = escapeHtml(group)
      return `<a class="badge group" href="./index.html#search/@${safeGroup}" x-group="${safeGroup}" style="background-color: #6a4fbb">@${safeGroup} <small>(${groups[group].length})</small></a>`
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
      loadGroupsOverview()
    })
  }
}
