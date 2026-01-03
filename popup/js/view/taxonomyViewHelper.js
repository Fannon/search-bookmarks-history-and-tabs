/**
 * @file Shared utility for rendering taxonomy overview pages (Tags, Folders, Tab Groups).
 */

import { escapeHtml } from '../helper/utils.js'

/**
 * Generic renderer for taxonomy views.
 * Handles sorting logic, empty states, badge generation, and sort toggle UI.
 *
 * @param {Object} config - Configuration for the taxonomy view.
 * @param {string} config.containerId - The ID of the DOM element to render into.
 * @param {Object} config.items - The taxonomy items object { name: [ids] }.
 * @param {string} config.marker - The prefix marker (#, ~, @).
 * @param {string} config.itemClass - The CSS class for badges (tags, folder, group).
 * @param {string} config.attrName - The attribute name for identifying the item (x-tag, x-folder, x-group).
 * @param {string} config.emptyStateHtml - HTML to show when no items are found.
 * @param {Function} config.rerenderFn - The function to call when sorting changes.
 * @param {string} [config.extraStyle] - Optional inline style for badges.
 */
export function renderTaxonomy({
  containerId,
  items,
  marker,
  itemClass,
  attrName,
  emptyStateHtml,
  rerenderFn,
  extraStyle = '',
}) {
  const sortMode = localStorage.getItem('taxonomySortMode') || 'alpha'
  const keys = Object.keys(items)

  // 1. Sorting Logic
  let sortedKeys = []
  if (sortMode === 'count') {
    sortedKeys = keys.sort((a, b) => {
      const countA = items[a].length
      const countB = items[b].length
      if (countA !== countB) {
        return countB - countA // Higher count first
      }
      return a.localeCompare(b, undefined, { sensitivity: 'base' })
    })
  } else {
    sortedKeys = keys.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  }

  const container = document.getElementById(containerId)
  if (!container) return

  // 2. Empty State
  if (sortedKeys.length === 0) {
    container.innerHTML = emptyStateHtml
    return
  }

  // 3. Badges Generation
  const badgesHTML = sortedKeys
    .map((key) => {
      const safeKey = escapeHtml(key)
      const encodedKey = encodeURIComponent(key)
      return `<a class="badge ${itemClass}" href="./index.html#search/${marker}${encodedKey}" ${attrName}="${safeKey}" ${
        extraStyle ? `style="${extraStyle}"` : ''
      }>${marker}${safeKey} <small>(${items[key].length})</small></a>`
    })
    .join('')

  // 4. Sort Toggle UI
  const sortLabel = sortMode === 'alpha' ? 'SORT BY COUNT' : 'SORT ALPHABETICALLY'
  const newSortMode = sortMode === 'alpha' ? 'count' : 'alpha'

  const sortDirectionIcon =
    sortMode === 'alpha'
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="icon-tabler-sort-descending"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 6l9 0" /><path d="M4 10l7 0" /><path d="M4 14l3 0" /><path d="M4 18l3 0" /><path d="M17 15l3 3l3 -3" /><path d="M20 6l0 12" /></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="icon-tabler-sort-ascending"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 6l7 0" /><path d="M4 10l7 0" /><path d="M4 14l3 0" /><path d="M17 9l3 -3l3 3" /><path d="M20 6l0 12" /></svg>`

  const sortTypeIcon =
    sortMode === 'alpha'
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="icon-tabler-123"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 10l2 -2v8" /><path d="M9 8h3a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-2a1 1 0 0 0 -1 1v2a1 1 0 0 0 1 1h3" /><path d="M17 8h2.5a1.5 1.5 0 0 1 1.5 1.5v1a1.5 1.5 0 0 1 -1.5 1.5h-1.5h1.5a1.5 1.5 0 0 1 1.5 1.5v1a1.5 1.5 0 0 1 -1.5 1.5h-2.5" /></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="icon-tabler-abc"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 16v-6a2 2 0 1 1 4 0v6" /><path d="M3 13h4" /><path d="M10 8v6a2 2 0 1 0 4 0v-1a2 2 0 1 0 -4 0v1" /><path d="M20.732 12a2 2 0 0 0 -3.732 1v1a2 2 0 0 0 3.726 1" /></svg>`

  container.innerHTML = `
    ${badgesHTML}
    <div class="taxonomy-footer">
      <button id="sort-toggle" class="button" data-sort="${newSortMode}" title="${sortLabel}">
        ${sortDirectionIcon}
        ${sortTypeIcon}
        ${sortLabel}
      </button>
    </div>
  `

  // 5. Event Listener
  const sortToggle = document.getElementById('sort-toggle')
  if (sortToggle) {
    sortToggle.addEventListener('click', () => {
      localStorage.setItem('taxonomySortMode', sortToggle.dataset.sort)
      rerenderFn()
    })
  }
}
