/**
 * @file Prepares the folders overview popup (`popup/folders.html`).
 *
 * Responsibilities:
 * - Initialise the shared extension context with tabs/history disabled so only bookmark folders participate.
 * - Transform bookmark metadata into folder aggregates with counts for quick browsing.
 * - Render folder navigation chips that link back into the main search view using hash routing.
 */

import { printError } from './helper/utils.js'
import { getEffectiveOptions } from './model/options.js'
import { getSearchData } from './model/searchData.js'
import { loadFoldersOverview } from './view/foldersView.js'
import { createExtensionContext } from './helper/extensionContext.js'

export const ext = (window.ext = createExtensionContext())

export async function initFoldersPage() {
  const loadingIndicator = document.getElementById('folders-loading')

  try {
    ext.dom.foldersOverview = document.getElementById('folders-overview')
    ext.dom.foldersList = document.getElementById('folders-list')

    ext.opts = await getEffectiveOptions()
    // Disable features not needed on the page
    ext.opts.enableTabs = false
    ext.opts.enableHistory = false
    const { bookmarks } = await getSearchData()
    ext.model.bookmarks = bookmarks

    loadFoldersOverview()
    ext.initialized = true
  } catch (error) {
    printError(error, 'Could not initialize folders view.')
  } finally {
    if (loadingIndicator) {
      loadingIndicator.remove()
    }
  }
}

initFoldersPage().catch((error) => {
  printError(error, 'Failed to load folders overview.')
})
