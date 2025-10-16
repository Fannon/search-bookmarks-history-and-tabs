//////////////////////////////////////////
// FOLDERS OVERVIEW                     //
//////////////////////////////////////////

import { getUniqueFolders } from '../search/taxonomySearch.js'

export function loadFoldersOverview() {
  const folders = getUniqueFolders()
  const sortedFolders = Object.keys(folders).sort()

  // Use template-based rendering for better performance with proper HTML escaping
  const badgesHTML = sortedFolders
    .map((folderName) => {
      // Properly escape quotes in folder names for href attributes to prevent parsing errors
      // Use single quotes for href attribute when folder name contains double quotes
      const targetHref = `./index.html#search/~${folderName}`
      const hrefAttribute = folderName.includes('"') ? `href='${targetHref}'` : `href="${targetHref}"`
      return `<a class="badge folder" ${hrefAttribute} x-folder="${folderName}">~${folderName} <small>(${folders[folderName].length})</small></a>`
    })
    .join('')

  document.getElementById('folders-list').innerHTML = badgesHTML
}
