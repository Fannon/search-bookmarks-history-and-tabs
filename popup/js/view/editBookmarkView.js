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
const BOOKMARKS_BAR_ALIASES = ['bookmarks bar', 'bookmarks toolbar']
const BOOKMARKS_BAR_IDS = ['1', 'toolbar_____']
const STAR_ICONS = {
  '': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873l-6.158 -3.245" /></svg>',
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
  button.dataset.bonusScore = String(score)
  button.title = state ? `Favorite (+${score})` : 'Favorite bookmark'
  button.setAttribute('aria-label', button.title)
  const icon = button.querySelector('svg')
  if (icon) {
    const container = document.createElement('span')
    container.innerHTML = STAR_ICONS[state]
    const newSvg = container.firstElementChild
    icon.replaceWith(newSvg)
  }
  const scoreNode = button.querySelector('.favorite-score')
  if (scoreNode) {
    scoreNode.textContent = `+${score}`
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
  const nextState = STAR_STATE_CYCLE[nextIndex]
  updateFavoriteButton(button, nextState, STAR_BONUS[nextState] || 0)
}

/**
 * Populate the bookmark editor form for the given bookmark id.
 *
 * @param {string} bookmarkId - Identifier of the bookmark to edit.
 * @returns {Promise<void>}
 */
export async function editBookmark(bookmarkId) {
  const bookmark = ext.model.bookmarks.find((el) => el.originalId === bookmarkId)
  const editContainer = document.getElementById('edit-bm')
  const titleInput = document.getElementById('bm-title')
  const urlInput = document.getElementById('bm-url')
  const tagsInput = document.getElementById('bm-tags')
  const saveButton = document.getElementById('bm-save')
  const deleteButton = document.getElementById('bm-del')
  const managerLink = document.getElementById('bm-manager')

  if (bookmark) {
    editContainer.style = ''
    titleInput.value = bookmark.title
    urlInput.value = bookmark.originalUrl
    const favoriteButton = document.getElementById('bm-favorite')
    if (favoriteButton) {
      const bonusScore = bookmark.customBonusScore || 0
      updateFavoriteButton(favoriteButton, getStarState(bonusScore), bonusScore)
    }

    const currentTags = (bookmark.tags || '')
      .split('#')
      .map((el) => el.trim())
      .filter((el) => el)
    setupTagEditor(tagsInput, currentTags)

    saveButton.dataset.bookmarkId = bookmarkId
    deleteButton.dataset.bookmarkId = bookmarkId
    deleteButton.style.display = ''
    if (managerLink) {
      managerLink.style.display = ''
      managerLink.href = `./bookmarkManager.html?bookmark=${encodeURIComponent(bookmarkId)}#bookmarks`
    }
    ext.currentBookmarkDraft = null
    ext.currentBookmarkId = bookmarkId
  } else {
    console.warn(`Tried to edit bookmark id="${bookmarkId}", but could not find it in searchData.`)
  }
}

/**
 * Populate the bookmark editor form for a new bookmark draft.
 *
 * @param {{title: string, url: string}} bookmarkDraft - Initial bookmark values.
 */
export function editNewBookmark(bookmarkDraft) {
  const editContainer = document.getElementById('edit-bm')
  const titleInput = document.getElementById('bm-title')
  const urlInput = document.getElementById('bm-url')
  const tagsInput = document.getElementById('bm-tags')
  const saveButton = document.getElementById('bm-save')
  const deleteButton = document.getElementById('bm-del')
  const managerLink = document.getElementById('bm-manager')
  const favoriteButton = document.getElementById('bm-favorite')

  editContainer.style = ''
  titleInput.value = bookmarkDraft.title || ''
  urlInput.value = bookmarkDraft.url || ''
  setupTagEditor(tagsInput, [])
  updateFavoriteButton(favoriteButton, '')

  delete saveButton.dataset.bookmarkId
  delete deleteButton.dataset.bookmarkId
  deleteButton.style.display = 'none'
  if (managerLink) {
    managerLink.style.display = 'none'
  }
  ext.currentBookmarkId = null
  ext.currentBookmarkDraft = bookmarkDraft
}

/**
 * Initialize or update the tag autocomplete field.
 *
 * @param {HTMLTextAreaElement|HTMLInputElement} tagsInput - Tags input element.
 * @param {string[]} currentTags - Tags to populate.
 */
function setupTagEditor(tagsInput, currentTags) {
  const uniqueTags = getUniqueTags() || {}
  const tags = Object.keys(uniqueTags).sort()

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

  ext.tagify.addTags(currentTags)

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
  if (!bookmark) {
    console.warn(`Tried to update bookmark id="${bookmarkId}", but could not find it in searchData.`)
    return
  }

  const formValues = getBookmarkFormValues()

  // Update search data model of bookmark
  bookmark.title = formValues.title
  bookmark.titleLower = formValues.title.toLowerCase().trim()
  bookmark.originalUrl = formValues.url
  bookmark.url = cleanUpUrl(formValues.url)
  bookmark.tags = formValues.tags
  bookmark.tagsLower = formValues.tags.toLowerCase()
  bookmark.tagsArray = formValues.tagsArray
  bookmark.tagsArrayLower = formValues.tagsArray.map((tag) => tag.toLowerCase())
  bookmark.customBonusScore = formValues.bonusScore
  bookmark.searchStringLower = createSearchStringLower(bookmark.title, bookmark.url, bookmark.tags, bookmark.folder)
  resetFuzzySearchState('bookmarks')
  resetSimpleSearchState('bookmarks')
  resetUniqueFoldersCache()

  if (browserApi.bookmarks) {
    browserApi.bookmarks.update(bookmarkId, {
      title: formValues.persistedTitle,
      url: formValues.url,
    })
  } else {
    console.warn(`No browser bookmarks API found. Bookmark update will not persist.`)
  }

  // Start search again to update the search index and the UI with new bookmark model
  navigateToSearchView()
}

/**
 * Create a new browser bookmark from the current form values.
 *
 * @returns {Promise<void>}
 */
export async function createBookmark() {
  const formValues = getBookmarkFormValues()

  if (!browserApi.bookmarks?.create) {
    console.warn(`No browser bookmarks API found. Bookmark create will not persist.`)
    return
  }

  const quickBookmarkFolderIds = getQuickBookmarkFolderIds()
  if (!quickBookmarkFolderIds.length) {
    return
  }

  let createdBookmark
  const createInfo = {
    title: formValues.persistedTitle,
    url: formValues.url,
  }

  for (const parentId of quickBookmarkFolderIds) {
    try {
      createdBookmark = await browserApi.bookmarks.create({
        ...createInfo,
        parentId,
      })
      break
    } catch (err) {
      console.warn(`Could not create bookmark in folder "${parentId}".`, err)
    }
  }

  if (!createdBookmark) {
    return
  }

  if (createdBookmark?.id) {
    const cleanedUrl = cleanUpUrl(formValues.url)
    ext.model.bookmarks.push({
      type: 'bookmark',
      originalId: createdBookmark.id,
      parentId: createdBookmark.parentId,
      index: createdBookmark.index,
      title: formValues.title,
      titleLower: formValues.title.toLowerCase().trim(),
      originalUrl: formValues.url,
      url: cleanedUrl,
      dateAdded: createdBookmark.dateAdded,
      customBonusScore: formValues.bonusScore,
      tags: formValues.tags,
      tagsLower: formValues.tags.toLowerCase(),
      tagsArray: formValues.tagsArray,
      tagsArrayLower: formValues.tagsArray.map((tag) => tag.toLowerCase()),
      folder: '',
      folderLower: '',
      folderArray: [],
      folderArrayLower: [],
      searchStringLower: createSearchStringLower(formValues.title, cleanedUrl, formValues.tags, ''),
    })
  }

  resetFuzzySearchState('bookmarks')
  resetSimpleSearchState('bookmarks')
  resetUniqueFoldersCache()
  navigateToSearchView()
}

/**
 * Resolve the configured quick-bookmark destination folder IDs.
 *
 * @returns {Array<string>} Candidate bookmark folder IDs.
 */
function getQuickBookmarkFolderIds() {
  const folderName = ext.opts.quickBookmarkCurrentTab
  if (typeof folderName !== 'string' || !folderName.trim()) {
    console.warn('Quick bookmark current tab is disabled or missing a folder name.')
    return []
  }

  const folder = findBookmarkFolder(ext.model.bookmarkTree || [], folderName)
  if (!folder) {
    console.warn(`Quick bookmark folder "${folderName}" was not found. Falling back to bookmarks bar root IDs.`)
    return BOOKMARKS_BAR_IDS
  }

  return [folder.id]
}

/**
 * Find a folder by exact ID first, then case-insensitive title.
 *
 * @param {Array<Object>} nodes - Browser bookmark tree nodes.
 * @param {string} folderRef - Configured folder ID or name.
 * @returns {Object|null} Matching folder node.
 */
function findBookmarkFolder(nodes, folderRef) {
  const trimmedRef = folderRef.trim()
  const byId = findBookmarkFolderById(nodes, trimmedRef)
  if (byId) {
    return byId
  }

  const byName = findBookmarkFolderByName(nodes, trimmedRef)
  if (byName) {
    return byName
  }

  if (BOOKMARKS_BAR_ALIASES.includes(trimmedRef.toLowerCase())) {
    return findBookmarksBarFolder(nodes)
  }

  return null
}

/**
 * Find the first folder in a bookmark tree matching an ID.
 *
 * @param {Array<Object>} nodes - Browser bookmark tree nodes.
 * @param {string} folderId - Configured folder ID.
 * @returns {Object|null} Matching folder node.
 */
function findBookmarkFolderById(nodes, folderId) {
  for (const node of nodes || []) {
    if (node?.children && String(node.id) === folderId) {
      return node
    }

    if (node?.children) {
      const childMatch = findBookmarkFolderById(node.children, folderId)
      if (childMatch) {
        return childMatch
      }
    }
  }

  return null
}

/**
 * Find the first folder in a bookmark tree matching a title.
 *
 * @param {Array<Object>} nodes - Browser bookmark tree nodes.
 * @param {string} folderName - Configured folder name.
 * @returns {Object|null} Matching folder node.
 */
function findBookmarkFolderByName(nodes, folderName) {
  const needle = folderName.toLowerCase()

  for (const node of nodes || []) {
    if (node?.children && typeof node.title === 'string' && node.title.toLowerCase() === needle) {
      return node
    }

    if (node?.children) {
      const childMatch = findBookmarkFolderByName(node.children, folderName)
      if (childMatch) {
        return childMatch
      }
    }
  }

  return null
}

/**
 * Find a browser's bookmarks toolbar folder by common root IDs or titles.
 *
 * @param {Array<Object>} nodes - Browser bookmark tree nodes.
 * @returns {Object|null} Matching toolbar folder node.
 */
function findBookmarksBarFolder(nodes) {
  for (const node of nodes || []) {
    if (
      node?.children &&
      (BOOKMARKS_BAR_IDS.includes(String(node.id)) || BOOKMARKS_BAR_ALIASES.includes(String(node.title).toLowerCase()))
    ) {
      return node
    }

    if (node?.children) {
      const childMatch = findBookmarksBarFolder(node.children)
      if (childMatch) {
        return childMatch
      }
    }
  }

  return null
}

/**
 * Read the bookmark editor form and build persisted bookmark fields.
 *
 * @returns {{title: string, url: string, tags: string, tagsArray: string[], bonusScore: number, persistedTitle: string}}
 */
function getBookmarkFormValues() {
  const title = document.getElementById('bm-title').value.trim()
  const url = document.getElementById('bm-url').value.trim()
  const favoriteButton = document.getElementById('bm-favorite')
  const bonusScore = Number.parseInt(favoriteButton?.dataset.bonusScore || '0', 10) || 0
  const tagsArray = ext.tagify.value.map((el) => el.value.trim()).filter((tag) => tag)
  const tags = tagsArray.length ? `#${tagsArray.join(' #')}` : ''

  let persistedTitle = title
  if (bonusScore) {
    persistedTitle += ` +${bonusScore}`
  }
  if (tags) {
    persistedTitle += ` ${tags}`
  }

  return {
    title,
    url,
    tags,
    tagsArray,
    bonusScore,
    persistedTitle,
  }
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
