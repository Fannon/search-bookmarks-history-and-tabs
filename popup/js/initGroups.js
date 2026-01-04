/**
 * @file Prepares the groups overview popup (`popup/groups.html`).
 *
 * Responsibilities:
 * - Initialise the shared extension context while disabling bookmarks/history sources to focus on tabs.
 * - Load tab data, aggregate unique groups with usage counts, and render them as clickable navigation chips.
 * - Link each group back into the main search view via hash routing so users can drill into results immediately.
 */

import { createExtensionContext } from './helper/extensionContext.js'
import { getEffectiveOptions } from './model/options.js'
import { getSearchData } from './model/searchData.js'
import { printError } from './view/errorView.js'
import { loadGroupsOverview } from './view/groupsView.js'

export const ext = createExtensionContext()
window.ext = ext

/**
 * Load tab data and render the groups overview page.
 *
 * @returns {Promise<void>}
 */
export async function initGroupsPage() {
  const loadingIndicator = document.getElementById('groups-load')

  try {
    ext.dom.groupsOverview = document.getElementById('groups-view')
    ext.dom.groupsList = document.getElementById('groups-list')

    ext.opts = await getEffectiveOptions()
    // Disable features not needed on the page
    ext.opts.enableBookmarks = false
    ext.opts.enableHistory = false

    const { tabs } = await getSearchData()
    ext.model.tabs = tabs

    loadGroupsOverview()
    ext.initialized = true
  } catch (error) {
    printError(error, 'Could not initialize groups view.')
  } finally {
    if (loadingIndicator) {
      loadingIndicator.remove()
    }
  }
}

initGroupsPage().catch((error) => {
  printError(error, 'Failed to load groups overview.')
})
