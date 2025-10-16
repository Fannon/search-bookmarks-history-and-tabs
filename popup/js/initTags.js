import { printError } from './helper/utils.js'
import { getEffectiveOptions } from './model/options.js'
import { getSearchData } from './model/searchData.js'
import { loadTagsOverview } from './view/tagsView.js'
import { createExtensionContext } from './extensionContext.js'

export const ext = createExtensionContext()

window.ext = ext

export async function initTagsPage() {
  const loadingIndicator = document.getElementById('tags-loading')

  try {
    ext.dom.tagsOverview = document.getElementById('tags-overview')
    ext.dom.tagsList = document.getElementById('tags-list')

    ext.opts = await getEffectiveOptions()
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
