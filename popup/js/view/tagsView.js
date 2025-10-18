/**
 * @file Renders the tags overview in the popup.
 *
 * Responsibilities:
 * - Aggregate bookmark tags with frequency counts to build a browsable taxonomy.
 * - Render lightweight badge markup that links back to the main search filtered by the chosen tag.
 * - Keep rendering efficient by generating HTML once per load and relying on delegation for navigation.
 */

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
