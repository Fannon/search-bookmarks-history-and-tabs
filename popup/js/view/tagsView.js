//////////////////////////////////////////
// TAGS OVERVIEW                        //
//////////////////////////////////////////

import { getUniqueTags } from '../search/taxonomySearch.js'

export function loadTagsOverview() {
  const tags = getUniqueTags()
  const sortedTags = Object.keys(tags).sort()

  // Use template-based rendering for better performance
  const badgesHTML = sortedTags
    .map(
      (tag) =>
        `<a class="badge tags" href="./index.html#search/#${tag}" x-tag="${tag}">#${tag} <small>(${tags[tag].length})</small></a>`,
    )
    .join('')

  document.getElementById('tags-list').innerHTML = badgesHTML
}
