/**
 * @file Prepares the tags overview popup (`popup/tags.html`).
 *
 * Responsibilities:
 * - Initialise the shared extension context while disabling tabs/history sources to focus on bookmark taxonomy.
 * - Load bookmark data, aggregate unique tags with usage counts, and render them as clickable navigation chips.
 * - Link each tag back into the main search view via hash routing so users can drill into results immediately.
 */

import { createExtensionContext } from './helper/extensionContext.js'

import { getEffectiveOptions } from './model/options.js'
import { getSearchData } from './model/searchData.js'
import { printError } from './view/errorView.js'
import { loadTagsOverview } from './view/tagsView.js'

export const ext = createExtensionContext()
window.ext = ext

/**
 * Load bookmark data and render the tags overview page.
 *
 * @returns {Promise<void>}
 */
export async function initTagsPage() {
  const loadingIndicator = document.getElementById('tags-load')

  try {
    ext.dom.tagsOverview = document.getElementById('tags-view')
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
