//////////////////////////////////////////
// FOLDERS OVERVIEW                     //
//////////////////////////////////////////

import { getUniqueFolders } from '../search/taxonomySearch.js'

export function loadFoldersOverview() {
  const folders = getUniqueFolders()
  const sortedFolders = Object.keys(folders).sort()

  const listElement = document.getElementById('folders-list')
  if (!listElement) {
    return
  }

  const fragment = document.createDocumentFragment()

  for (const folderName of sortedFolders) {
    const anchor = document.createElement('a')
    anchor.className = 'badge folder'
    anchor.setAttribute('href', `./index.html#search/~${folderName}`)
    anchor.setAttribute('x-folder', folderName)
    anchor.appendChild(document.createTextNode(`~${folderName} `))

    const count = document.createElement('small')
    count.textContent = `(${folders[folderName].length})`
    anchor.appendChild(count)

    fragment.appendChild(anchor)
  }

  listElement.replaceChildren(fragment)
}
