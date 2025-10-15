//////////////////////////////////////////
// FOLDERS OVERVIEW                     //
//////////////////////////////////////////

import { getUniqueFolders } from '../search/taxonomySearch.js'

export function loadFoldersOverview() {
  const folders = getUniqueFolders()
  document.getElementById('folders-overview').style = ''
  const sortedFolders = Object.keys(folders).sort()

  // Use template-based rendering for better performance
  const badgesHTML = sortedFolders
    .map(
      (folderName) =>
        `<a class="badge folder" href="#search/~${folderName}" x-folder="${folderName}">~${folderName} <small>(${folders[folderName].length})</small></a>`,
    )
    .join('')

  document.getElementById('folders-list').innerHTML = badgesHTML
}
