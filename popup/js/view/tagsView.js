//////////////////////////////////////////
// TAGS OVERVIEW                        //
//////////////////////////////////////////

import { getUniqueTags } from '../search/taxonomySearch.js'

export function loadTagsOverview() {
  const tags = getUniqueTags()
  document.getElementById('tags-overview').style = ''
  const sortedTags = Object.keys(tags).sort()
  document.getElementById('tags-list').innerHTML = sortedTags
    .map((el) => {
      return `<a class="badge tags" href="#search/#${el}" x-tag="${el}">#${el} <small>(${tags[el].length})<small></a>`
    })
    .join('')
}
