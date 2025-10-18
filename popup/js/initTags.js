//////////////////////////////////////////
// TAGS OVERVIEW PAGE ENTRY POINT       //
//////////////////////////////////////////

/**
 * Entry point for the tags overview page (popup/tags.html)
 *
 * Responsibilities:
 * - Initialize the shared extension context (ext object)
 * - Load bookmark data from browser storage
 * - Extract and aggregate unique tags from all bookmarks
 * - Render clickable tag badges with item counts
 *
 * The tags overview provides a browsable index of all tags in use,
 * allowing users to click a tag to search for bookmarks with that tag.
 * Only bookmarks are loaded (tabs and history disabled for this page).
 */

import { printError } from './helper/utils.js'
import { getEffectiveOptions } from './model/options.js'
import { getSearchData } from './model/searchData.js'
import { loadTagsOverview } from './view/tagsView.js'
import { createExtensionContext } from './helper/extensionContext.js'

export const ext = (window.ext = createExtensionContext())

export async function initTagsPage() {
  const loadingIndicator = document.getElementById('tags-loading')

  try {
    ext.dom.tagsOverview = document.getElementById('tags-overview')
    ext.dom.tagsList = document.getElementById('tags-list')

    ext.opts = await getEffectiveOptions()
    // Disable features not needed on the page
    ext.opts.enableTabs = false
    ext.opts.enableHistory = false

    const { bookmarks } = await getSearchData()
    ext.model.bookmarks = bookmarks

    loadTagsOverview()
    ext.initialized = true
  } catch (error) {
    printError(error, 'Could not initialize tags view.')
  } finally {
    if (loadingIndicator) {
      loadingIndicator.remove()
    }
  }
}

initTagsPage().catch((error) => {
  printError(error, 'Failed to load tags overview.')
})
