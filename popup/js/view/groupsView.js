/**
 * @file Renders the tab groups overview in the popup.
 *
 * Responsibilities:
 * - Aggregate open tab groups with tab counts to build a browsable taxonomy.
 * - Render lightweight badge markup that links back to the main search filtered by the chosen group.
 */

import { getUniqueGroups } from '../search/taxonomySearch.js'
import { renderTaxonomy } from './taxonomyViewHelper.js'

/**
 * Render the unique tab groups as clickable badges.
 */
export async function loadGroupsOverview() {
  const container = document.getElementById('groups-list')
  if (!container) return

  // 1. Permission Check (Chrome only)
  let hasPermission = false
  if (typeof chrome !== 'undefined' && chrome.permissions && chrome.permissions.contains) {
    hasPermission = await new Promise((resolve) => {
      chrome.permissions.contains({ permissions: ['tabGroups'] }, resolve)
    })
  } else if (typeof chrome !== 'undefined' && chrome.tabGroups) {
    // If permission isn't explicitly checkable but API exists
    hasPermission = true
  }

  if (!hasPermission) {
    container.innerHTML = `
      <div class="empty warning">
        <strong>Permission missing</strong>
        <p>This feature requires the <strong>tabGroups</strong> permission to read group names.</p>
        <p>Ensure that your browser is based on Chrome (e.g., Google Chrome, Microsoft Edge, Brave) and that you have granted the necessary permissions.</p>
        <p><em>Note: Firefox currently does not support the Tab Groups API.</em></p>
        <p>
          <a href="https://support.google.com/chrome/answer/2391819" target="_blank">
            Learn more about Tab Groups (Chrome) →
          </a>
        </p>
      </div>
    `
    return
  }

  // 2. Fetch and Render Groups
  const groups = await getUniqueGroups()

  renderTaxonomy({
    containerId: 'groups-list',
    items: groups,
    marker: '@',
    itemClass: 'group',
    attrName: 'x-group',
    rerenderFn: loadGroupsOverview,
    extraStyle: 'background-color: #6a4fbb',
    emptyStateHtml: `
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
    `,
  })
}
