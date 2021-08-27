//////////////////////////////////////////
// FOLDERS OVERVIEW                     //
//////////////////////////////////////////

import { getUniqueFolders } from '../search/taxonomySearch.js'

export function loadFoldersOverview() {
  const folders = getUniqueFolders()
  document.getElementById('folders-overview').style = ''
  const sortedFolders = Object.keys(folders).sort()
  document.getElementById('folders-list').innerHTML = sortedFolders
    .map((el) => {
      return `<a class="badge folder" href="#search/~${el}" x-folder="${el}">~${el} <small>(${folders[el].length})<small></a>`
    })
    .join('')
}
