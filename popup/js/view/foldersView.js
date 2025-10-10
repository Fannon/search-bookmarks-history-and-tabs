//////////////////////////////////////////
// FOLDERS OVERVIEW                     //
//////////////////////////////////////////

import { getUniqueFolders } from '../search/taxonomySearch.js'

export function loadFoldersOverview() {
  const folders = getUniqueFolders()
  document.getElementById('folders-overview').style = ''
  const sortedFolders = Object.keys(folders).sort()
  const listEl = document.getElementById('folders-list')
  listEl.replaceChildren()

  const fragment = document.createDocumentFragment()
  for (const folderName of sortedFolders) {
    const badge = document.createElement('a')
    badge.className = 'badge folder'
    badge.setAttribute('href', `#search/~${folderName}`)
    badge.setAttribute('x-folder', folderName)
    badge.append(`~${folderName} `)

    const count = document.createElement('small')
    count.textContent = `(${folders[folderName].length})`
    badge.appendChild(count)

    fragment.appendChild(badge)
  }

  listEl.appendChild(fragment)
}
