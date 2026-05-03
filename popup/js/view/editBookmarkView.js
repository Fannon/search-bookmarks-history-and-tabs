/**
 * @file Drives the bookmark editor interactions and form logic.
 *
 * Responsibilities:
 * - Load bookmark data for editing and initialize Tagify-powered tag autocompletion.
 * - Validate user input, persist updates through the browser API, and surface inline errors.
 * - Handle delete/cancel flows plus bonus-score parsing while keeping the UI responsive.
 * - Invalidate search caches and taxonomy indexes so edits reflect immediately in the popup search view.
 */

import { browserApi, createSearchStringLower } from '../helper/browserApi.js'
import { cleanUpUrl } from '../helper/utils.js'
import { resetFuzzySearchState } from '../search/fuzzySearch.js'
import { resetSimpleSearchState } from '../search/simpleSearch.js'
import { getUniqueTags, resetUniqueFoldersCache } from '../search/taxonomySearch.js'

const STAR_STATE_CYCLE = ['', 'yellow', 'orange', 'red']
const STAR_BONUS = { yellow: 25, orange: 50, red: 75 }
const STAR_ICONS = {
  '': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a8a8a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873l-6.158 -3.245" /></svg>',
  yellow:
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#f4c430" stroke="#6f5200" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M8.243 7.34l-6.38 .925l-.113 .023a1 1 0 0 0 -.44 1.684l4.622 4.499l-1.09 6.355l-.013 .11a1 1 0 0 0 1.464 .944l5.706 -3l5.693 3l.1 .046a1 1 0 0 0 1.352 -1.1l-1.091 -6.355l4.624 -4.5l.078 -.085a1 1 0 0 0 -.633 -1.62l-6.38 -.926l-2.852 -5.78a1 1 0 0 0 -1.794 0l-2.853 5.78z" /></svg>',
  orange:
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#FF8C00" stroke="#7a4a00" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M8.243 7.34l-6.38 .925l-.113 .023a1 1 0 0 0 -.44 1.684l4.622 4.499l-1.09 6.355l-.013 .11a1 1 0 0 0 1.464 .944l5.706 -3l5.693 3l.1 .046a1 1 0 0 0 1.352 -1.1l-1.091 -6.355l4.624 -4.5l.078 -.085a1 1 0 0 0 -.633 -1.62l-6.38 -.926l-2.852 -5.78a1 1 0 0 0 -1.794 0l-2.853 5.78z" /></svg>',
  red: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#ee4343" stroke="#8b0000" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M8.243 7.34l-6.38 .925l-.113 .023a1 1 0 0 0 -.44 1.684l4.622 4.499l-1.09 6.355l-.013 .11a1 1 0 0 0 1.464 .944l5.706 -3l5.693 3l.1 .046a1 1 0 0 0 1.352 -1.1l-1.091 -6.355l4.624 -4.5l.078 -.085a1 1 0 0 0 -.633 -1.62l-6.38 -.926l-2.852 -5.78a1 1 0 0 0 -1.794 0l-2.853 5.78z" /></svg>',
}

/**
 * Determine the star state from a bookmark's customBonusScore.
 *
 * @param {number} customBonusScore - Parsed bonus score from bookmark title.
 * @returns {string} Star state: '', 'yellow', or 'orange'.
 */
export function getStarState(customBonusScore) {
  if (customBonusScore >= 51) return 'red'
  if (customBonusScore >= 26) return 'orange'
  if (customBonusScore > 0) return 'yellow'
  return ''
}

/**
 * Update the favorite button's visual state and data attributes.
 *
 * @param {HTMLButtonElement} button - The #bm-favorite button element.
 * @param {string} state - Star state: '', 'yellow', or 'orange'.
 */
export function updateFavoriteButton(button, state, bonusScore) {
  if (!button) return
  button.dataset.favorite = state
  button.setAttribute('aria-pressed', state ? 'true' : 'false')
  const score = bonusScore != null ? bonusScore : STAR_BONUS[state] || 0
  const label = state ? `★${state === 'orange' ? '★' : state === 'red' ? '★★' : ''} (+${score})` : 'FAVORITE'
  button.title = state ? `Favorite (+${score})` : 'Favorite bookmark'
  const icon = button.querySelector('svg')
  if (icon) {
    const container = document.createElement('span')
    container.innerHTML = STAR_ICONS[state]
    const newSvg = container.firstElementChild
    icon.replaceWith(newSvg)
  }
  const textNode = button.querySelector('.favorite-label')
  if (textNode) {
    textNode.textContent = label
  }
}

/**
 * Cycle the favorite button through star states: '' -> 'yellow' -> 'orange' -> ''.
 *
 * @param {HTMLButtonElement} button - The #bm-favorite button element.
 */
export function cycleFavoriteButton(button) {
  if (!button) return
  const current = button.dataset.favorite || ''
  const nextIndex = (STAR_STATE_CYCLE.indexOf(current) + 1) % STAR_STATE_CYCLE.length
  updateFavoriteButton(button, STAR_STATE_CYCLE[nextIndex])
}

/**
 * Populate the bookmark editor form for the given bookmark id.
 *
 * @param {string} bookmarkId - Identifier of the bookmark to edit.
 * @returns {Promise<void>}
 */
export async function editBookmark(bookmarkId) {
  const bookmark = ext.model.bookmarks.find((el) => el.originalId === bookmarkId)
  const uniqueTags = getUniqueTags() || {}
  const tags = Object.keys(uniqueTags).sort()
  const editContainer = document.getElementById('edit-bm')
  const titleInput = document.getElementById('bm-title')
  const urlInput = document.getElementById('bm-url')
  const tagsInput = document.getElementById('bm-tags')
  const saveButton = document.getElementById('bm-save')
  const deleteButton = document.getElementById('bm-del')

  if (bookmark) {
    editContainer.style = ''
    titleInput.value = bookmark.title
    urlInput.value = bookmark.originalUrl
    const favoriteButton = document.getElementById('bm-favorite')
    if (favoriteButton) {
      const bonusScore = bookmark.customBonusScore || 0
      updateFavoriteButton(favoriteButton, getStarState(bonusScore), bonusScore)
    }
    if (!ext.tagify) {
      ext.tagify = new Tagify(tagsInput, {
        whitelist: tags,
        trim: true,
        transformTag,
        skipInvalid: false,
        editTags: {
          clicks: 1,
          keepInvalid: false,
        },
        dropdown: {
          position: 'all',
          enabled: 0,
          maxItems: 12,
          closeOnSelect: false,
        },
      })
    } else {
      // If tagify was already initialized:
      // reset current and available tags to new state
      ext.tagify.removeAllTags()
      ext.tagify.whitelist = tags
    }

    const currentTags = bookmark.tags
      .split('#')
      .map((el) => el.trim())
      .filter((el) => el)
    ext.tagify.addTags(currentTags)

    saveButton.dataset.bookmarkId = bookmarkId
    deleteButton.dataset.bookmarkId = bookmarkId
    ext.currentBookmarkId = bookmarkId
  } else {
    console.warn(`Tried to edit bookmark id="${bookmarkId}", but could not find it in searchData.`)
  }

  function transformTag(tagData) {
    if (tagData.value.includes('#')) {
      tagData.value = tagData.value.split('#').join('')
    }
  }
}

/**
 * Apply form changes to the data model and browser bookmarks API.
 *
 * @param {string} bookmarkId - Identifier of the bookmark being updated.
 */
export function updateBookmark(bookmarkId) {
  const bookmark = ext.model.bookmarks.find((el) => el.originalId === bookmarkId)
  const titleInput = document.getElementById('bm-title').value.trim()
  const urlInput = document.getElementById('bm-url').value.trim()
  const favoriteButton = document.getElementById('bm-favorite')
  const favoriteState = favoriteButton?.dataset.favorite || ''
  const bonusScore = STAR_BONUS[favoriteState] || 0
  let tagsInput = ''
  if (ext.tagify.value.length) {
    tagsInput = `#${ext.tagify.value.map((el) => el.value.trim()).join(' #')}`
  }

  // Build persisted title: title + bonus + tags
  let persistedTitle = titleInput
  if (bonusScore) {
    persistedTitle += ` +${bonusScore}`
  }
  if (tagsInput) {
    persistedTitle += ` ${tagsInput}`
  }

  // Update search data model of bookmark
  bookmark.title = titleInput
  bookmark.originalUrl = urlInput
  bookmark.url = cleanUpUrl(urlInput)
  bookmark.tags = tagsInput
  bookmark.customBonusScore = bonusScore
  bookmark.searchStringLower = createSearchStringLower(bookmark.title, bookmark.url, bookmark.tags, bookmark.folder)
  resetFuzzySearchState('bookmarks')
  resetSimpleSearchState('bookmarks')
  resetUniqueFoldersCache()

  if (browserApi.bookmarks) {
    browserApi.bookmarks.update(bookmarkId, {
      title: persistedTitle,
      url: urlInput,
    })
  } else {
    console.warn(`No browser bookmarks API found. Bookmark update will not persist.`)
  }

  // Start search again to update the search index and the UI with new bookmark model
  navigateToSearchView()
}

/**
 * Remove a bookmark via the browser API and refresh search caches.
 *
 * @param {string} bookmarkId - Identifier of the bookmark to delete.
 * @returns {Promise<void>}
 */
export async function deleteBookmark(bookmarkId) {
  if (browserApi.bookmarks) {
    browserApi.bookmarks.remove(bookmarkId)
  } else {
    console.warn(`No browser bookmarks API found. Bookmark remove will not persist.`)
  }

  // Remove item from search data and reset search caches
  ext.model.bookmarks = ext.model.bookmarks.filter((el) => {
    return el.originalId !== bookmarkId
  })
  resetFuzzySearchState('bookmarks')
  resetSimpleSearchState('bookmarks')
  resetUniqueFoldersCache()

  navigateToSearchView()
}

/**
 * Navigate back to the search view, preserving return hashes when possible.
 */
function navigateToSearchView() {
  const redirectHash =
    ext && typeof ext.returnHash === 'string' && ext.returnHash.startsWith('#search') ? ext.returnHash : '#search/'
  const redirectTarget = `./index.html${redirectHash}`
  let resolvedTarget = redirectTarget
  try {
    resolvedTarget = new URL(redirectTarget, window.location.href).toString()
  } catch {
    resolvedTarget = redirectTarget
  }
  try {
    if (typeof window.location.assign === 'function') {
      window.location.assign(resolvedTarget)
    } else {
      window.location.href = resolvedTarget
    }
  } catch (navigationError) {
    console.warn('Navigation to search view not supported in this environment.', navigationError)
    if (window.history?.replaceState) {
      try {
        window.history.replaceState(null, '', resolvedTarget)
      } catch (historyError) {
        console.warn('Failed to update history state for search view navigation.', historyError)
      }
    }
  }
}
