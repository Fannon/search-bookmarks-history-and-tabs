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
  const sortedFolders = Object.keys(folders).sort()

  const container = document.getElementById('folders-list')
  if (!container) {
    return
  }

  const badgesHTML = sortedFolders
    .map((folderName) => {
      const safeName = escapeHtml(folderName)
      return `<a class="badge folder" href="./index.html#search/~${safeName}" x-folder="${safeName}">~${safeName} <small>(${folders[folderName].length})</small></a>`
    })
    .join('')

  container.innerHTML = badgesHTML
}
