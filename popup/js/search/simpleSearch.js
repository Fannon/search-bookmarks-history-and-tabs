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

  if (searchMode === 'history') {
    results = simpleSearchWithScoring(searchTerm, ext.model.history)
  } else if (searchMode === 'bookmarks') {
    results = simpleSearchWithScoring(searchTerm, ext.model.bookmarks)
  } else if (searchMode === 'tabs') {
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
 * Very simple search algorithm :)
 * This does an `includes` search with an AND condition between the terms
 *
 * TODO: Right now there is no real scoring
 */
function simpleSearchWithScoring(searchTerm, data) {
  /** Search results */
  const results = []

  let searchTermArray = searchTerm.split(' ')

  if (searchTermArray.length) {
    for (const entry of data) {
      const searchString = `${entry.title} ${entry.url || ''} ${entry.tags || ''} ${entry.folder || ''}`.toLowerCase()

      //
      let searchTermMatches = 0
      for (const term of searchTermArray) {
        if (searchString.includes(term)) {
          searchTermMatches++
        }
      }
      if (searchTermMatches === searchTermArray.length) {
        results.push({
          ...entry,
          searchScore: 1,
          searchApproach: 'precise',
        })
      }
    }
  }

  return results
}
