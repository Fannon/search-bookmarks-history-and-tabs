//////////////////////////////////////////
// TAGS OVERVIEW                        //
//////////////////////////////////////////

import { getUniqueTags } from '../search/taxonomySearch.js'

export function loadTagsOverview() {
  const tags = getUniqueTags()
  const sortedTags = Object.keys(tags).sort()

  const listElement = document.getElementById('tags-list')
  if (!listElement) {
    return
  }

  const fragment = document.createDocumentFragment()

  for (const tag of sortedTags) {
    const anchor = document.createElement('a')
    anchor.className = 'badge tags'
    anchor.setAttribute('href', `./index.html#search/#${tag}`)
    anchor.setAttribute('x-tag', tag)
    anchor.appendChild(document.createTextNode(`#${tag} `))

    const count = document.createElement('small')
    count.textContent = `(${tags[tag].length})`
    anchor.appendChild(count)

    fragment.appendChild(anchor)
  }

  listElement.replaceChildren(fragment)
}
