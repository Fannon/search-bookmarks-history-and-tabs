//////////////////////////////////////////
// SIMPLE SEARCH SUPPORT                   //
//////////////////////////////////////////

/**
 * Search with a simple self-implemented search, without creating indexes in the first place.
 */
export function searchWithSimpleSearch(searchTerm, searchMode) {
  let results = []

  // If the search term is below minMatchCharLength, no point in starting search
  if (searchTerm.length < ext.opts.searchMinMatchCharLength) {
    return results
  }

  performance.mark('search-start')

  searchMode = searchMode || 'all'

  console.debug(`🔍 Searching with approach="precise" and mode="${searchMode}" for searchTerm="${searchTerm}"`)

  if (searchMode === 'history' && ext.index.precise.history) {
    results = simpleSearchWithScoring(searchTerm, ext.model.history)
  } else if (searchMode === 'bookmarks' && ext.index.precise.bookmarks) {
    results = simpleSearchWithScoring(searchTerm, ext.model.bookmarks)
  } else if (searchMode === 'tabs' && ext.index.precise.tabs) {
    results = simpleSearchWithScoring(searchTerm, ext.model.tabs)
  } else if (searchMode === 'search') {
    // nothing, because search will be added later
  } else {
    if (ext.opts.enableBookmarks) {
      results.push(...simpleSearchWithScoring(searchTerm, ext.model.bookmarks))
    }
    if (ext.opts.enableTabs) {
      results.push(...simpleSearchWithScoring(searchTerm, ext.model.tabs))
    }
    if (ext.opts.enableHistory) {
      results.push(...simpleSearchWithScoring(searchTerm, ext.model.history))
    }
  }

  performance.mark('search-end')
  performance.measure('search-simple: ' + searchTerm, 'search-start', 'search-end')
  const searchPerformance = performance.getEntriesByType('measure')
  console.debug(
    'Found ' + results.length + ' results with approach="precise" in ' + searchPerformance[0].duration + 'ms',
    searchPerformance,
  )
  performance.clearMeasures()

  return results
}

/**
 * Helper function to make a flexsearch search and include the element along with a score
 * This also includes some custom boolean logic how search terms lead to a match across multiple fields
 */
function simpleSearchWithScoring(searchTerm, data) {
  /** Search results */
  const results = []

  // Simulate an OR search with the terms in searchTerm, separated by spaces
  let searchTermArray = searchTerm.split(' ')
  // filter out all search terms that do not match the min char match length
  searchTermArray = searchTermArray.filter((el) => el.length >= ext.opts.searchMinMatchCharLength)

  if (!searchTermArray.length) {
    // Early return if none of the search terms have enough char length
    return []
  }

  for (const term of searchTermArray) {
    for (const entry of data) {
      const searchString = (
        entry.title + ' ' + entry.url ||
        '' + ' ' + entry.tags ||
        '' + ' ' + entry.folder ||
        ''
      ).toLowerCase()

      const resultEntry = {
        ...entry,
        searchScore: 1,
        searchApproach: 'precise',
      }

      // Very simple search algorithm :)
      if (searchString.includes(term)) {
        results.push(resultEntry)
      }
    }
  }

  return results
}
