//////////////////////////////////////////
// BOOKMARK EDITING                     //
//////////////////////////////////////////

import { browserApi, createSearchString } from '../helper/browserApi.js'
import { cleanUpUrl, loadScript } from '../helper/utils.js'
import { resetFuzzySearchState } from '../search/fuzzySearch.js'
import { getUniqueTags } from '../search/taxonomySearch.js'
import { search } from '../search/common.js'
import { resetSimpleSearchState } from '../search/simpleSearch.js'

let tagifyLoaded = false

export async function editBookmark(bookmarkId) {
  // Lazy load tagify if it has not been loaded already
  if (!tagifyLoaded) {
    await loadScript('./lib/tagify.min.js')
    tagifyLoaded = true
  }

  const bookmark = ext.model.bookmarks.find((el) => el.originalId === bookmarkId)
  const tags = Object.keys(getUniqueTags()).sort()
  if (ext.opts.debug) {
    console.debug('Editing bookmark ' + bookmarkId, bookmark)
  }
  if (bookmark) {
    document.getElementById('edit-bookmark').style = ''
    document.getElementById('bookmark-title').value = bookmark.title
    document.getElementById('bookmark-url').value = bookmark.originalUrl
    if (!ext.tagify) {
      ext.tagify = new Tagify(document.getElementById('bookmark-tags'), {
        whitelist: tags,
        trim: true,
        transformTag: transformTag,
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

    document.getElementById('edit-bookmark-save').href = '#update-bookmark/' + bookmarkId

    document.getElementById('edit-bookmark-delete').addEventListener('click', (event) => {
      deleteBookmark(bookmarkId)
      event.stopPropagation()
    })
  } else {
    console.warn(`Tried to edit bookmark id="${bookmarkId}", but could not find it in searchData.`)
  }

  function transformTag(tagData) {
    if (tagData.value.includes('#')) {
      tagData.value = tagData.value.split('#').join('')
    }
  }
}

export function updateBookmark(bookmarkId) {
  const bookmark = ext.model.bookmarks.find((el) => el.originalId === bookmarkId)
  const titleInput = document.getElementById('bookmark-title').value.trim()
  const urlInput = document.getElementById('bookmark-url').value.trim()
  let tagsInput = ''
  if (ext.tagify.value.length) {
    tagsInput = '#' + ext.tagify.value.map((el) => el.value.trim()).join(' #')
  }

  // Update search data model of bookmark
  bookmark.title = titleInput
  bookmark.originalUrl = urlInput
  bookmark.url = cleanUpUrl(urlInput)
  bookmark.tags = tagsInput
  bookmark.searchString = createSearchString(bookmark.title, bookmark.url, bookmark.tags, bookmark.folder)
  resetFuzzySearchState('bookmarks')
  resetSimpleSearchState('bookmarks')

  if (ext.opts.debug) {
    console.debug(`Update bookmark with ID ${bookmarkId}: "${titleInput} ${tagsInput}"`)
  }

  if (browserApi.bookmarks) {
    browserApi.bookmarks.update(bookmarkId, {
      title: `${titleInput} ${tagsInput}`,
      url: urlInput,
    })
  } else {
    console.warn(`No browser bookmarks API found. Bookmark update will not persist.`)
  }

  // Start search again to update the search index and the UI with new bookmark model
  window.location.href = '#'
}

export async function deleteBookmark(bookmarkId) {
  if (browserApi.bookmarks) {
    browserApi.bookmarks.remove(bookmarkId)
  } else {
    console.warn(`No browser bookmarks API found. Bookmark remove will not persist.`)
  }

  // Remove item from search data and reset search caches
  ext.model.bookmarks = ext.model.bookmarks.filter((el) => {
    el.originalId !== bookmarkId
  })
  resetFuzzySearchState('bookmarks')
  resetSimpleSearchState('bookmarks')

  // Re-execute search
  await search()
  window.location.href = '#search/'
}
