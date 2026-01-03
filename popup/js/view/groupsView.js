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
  const sortedGroups = Object.keys(groups).sort()

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

  container.innerHTML = badgesHTML
}
