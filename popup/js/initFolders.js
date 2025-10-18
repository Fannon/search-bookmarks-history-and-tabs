//////////////////////////////////////////
// FOLDERS OVERVIEW PAGE ENTRY POINT    //
//////////////////////////////////////////

/**
 * Entry point for the folders overview page (popup/folders.html)
 *
 * Responsibilities:
 * - Initialize the shared extension context (ext object)
 * - Load bookmark data from browser storage
 * - Extract and aggregate unique bookmark folders from the tree
 * - Render clickable folder badges with item counts
 *
 * The folders overview provides a browsable index of the bookmark folder
 * hierarchy, allowing users to click a folder to search for bookmarks in that folder.
 * Only bookmarks are loaded (tabs and history disabled for this page).
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
