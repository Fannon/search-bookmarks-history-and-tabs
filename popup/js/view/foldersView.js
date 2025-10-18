//////////////////////////////////////////
// FOLDERS OVERVIEW                     //
//////////////////////////////////////////

import { escapeHtml } from '../helper/utils.js'
import { getUniqueFolders } from '../search/taxonomySearch.js'

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
