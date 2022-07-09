//////////////////////////////////////////
// FLEXSEARCH SUPPORT                   //
//////////////////////////////////////////

// @see https://github.com/nextapps-de/flexsearch

/**
 * Creates precise search indexes with flexsearch
 */
export function createPreciseIndexes() {
  // no-op
}

/**
 * Search with the flexsearch library
 *
 * @see https://github.com/nextapps-de/flexsearch
 */
export function searchWithFlexSearch(searchTerm, searchMode) {
  let results = []

  // If the search term is below minMatchCharLength, no point in starting search
  if (searchTerm.length < ext.opts.searchMinMatchCharLength) {
    return results
  }

  performance.mark('search-start')

  searchMode = searchMode || 'all'

  console.debug(`Searching with approach="simple" and mode="${searchMode}" for searchTerm="${searchTerm}"`)

  if (searchMode === 'history' && ext.index.precise.history) {
    results = simpleSearchWithScoring('history', searchTerm, ext.model.history)
  } else if (searchMode === 'bookmarks' && ext.index.precise.bookmarks) {
    results = simpleSearchWithScoring('bookmarks', searchTerm, ext.model.bookmarks)
  } else if (searchMode === 'tabs' && ext.index.precise.tabs) {
    results = simpleSearchWithScoring('tabs', searchTerm, ext.model.tabs)
  } else if (searchMode === 'search') {
    // nothing, because search will be added later
  } else {
    if (ext.index.precise.bookmarks) {
      results.push(...simpleSearchWithScoring('bookmarks', searchTerm, ext.model.bookmarks))
    }
    if (ext.index.precise.tabs) {
      results.push(...simpleSearchWithScoring('tabs', searchTerm, ext.model.tabs))
    }
    if (ext.index.precise.history) {
      results.push(...simpleSearchWithScoring('history', searchTerm, ext.model.history))
    }
  }

  performance.mark('search-end')
  performance.measure('search-flexsearch: ' + searchTerm, 'search-start', 'search-end')
  const searchPerformance = performance.getEntriesByType('measure')
  console.debug('Search Performance (flexsearch): ' + searchPerformance[0].duration + 'ms', searchPerformance)
  performance.clearMeasures()

  return results
}

/**
 * Helper function to make a flexsearch search and include the element along with a score
 * This also includes some custom boolean logic how search terms lead to a match across multiple fields
 */
function simpleSearchWithScoring(indexName, searchTerm, data) {
  const index = ext.index.precise[indexName]

  /** Dictionary to hold all search matches, grouped by search term and field name */
  const matchesDict = {}

  // Simulate an OR search with the terms in searchTerm, separated by spaces
  let searchTermArray = searchTerm.split(' ')
  // filter out all search terms that do not match the min char match length
  searchTermArray = searchTermArray.filter((el) => el.length >= ext.opts.searchMinMatchCharLength)

  if (!searchTermArray.length) {
    // Early return if none of the search terms have enough char length
    return []
  }

  let overallMatchCounter = 0
  for (const term of searchTermArray) {
    matchesDict[term] = {}

    // Search title field
    matchesDict[term].title = index.title.search(term, ext.opts.searchMaxResults)

    // Search url field
    matchesDict[term].url = index.url.search(term, ext.opts.searchMaxResults)

    // search tags if available (only bookmarks)
    if (index.tag) {
      matchesDict[term].tag = index.tag.search(term, ext.opts.searchMaxResults)
    }

    // search folder if available (only bookmarks)
    if (index.folder) {
      matchesDict[term].folder = index.folder.search(term, ext.opts.searchMaxResults)
    }

    // Count how many individual search terms we have found across all the fields
    if (
      matchesDict[term].title.length +
      matchesDict[term].url.length +
      (matchesDict[term].tag || []).length +
      (matchesDict[term].folder || []).length
    ) {
      overallMatchCounter += 1
    }
  }

  // Early return if we don't have at least one field match
  if (overallMatchCounter === 0) {
    return []
  }

  const resultDict = {}

  for (const term in matchesDict) {
    for (const field in matchesDict[term]) {
      const matches = matchesDict[term][field]
      const optionName = 'score' + field.charAt(0).toUpperCase() + field.slice(1) + 'Weight'

      for (const matchIndex of matches) {
        const el = data[matchIndex]

        if (!resultDict[matchIndex]) {
          resultDict[matchIndex] = {
            searchScore: ext.opts[optionName],
            searchTermMatches: {},
            ...el,
          }
        } else {
          // Result is already there, we just need to update the score and counters
          let searchScore = ext.opts[optionName]
          if (resultDict[matchIndex].searchScore < searchScore) {
            const newScore = searchScore + resultDict[matchIndex].searchScore / 5
            resultDict[matchIndex].searchScore = newScore
          } else {
            resultDict[matchIndex].searchScore += searchScore / 5
          }
        }

        resultDict[matchIndex].searchTermMatches[term] = true
      }
    }
  }

  let results = Object.values(resultDict)

  // Filter out all results that don't meed the minimum required search term match ratio
  results = results.filter((el) => {
    const searchTermMatchRatio = Object.keys(el.searchTermMatches).length / searchTermArray.length
    return searchTermMatchRatio >= ext.opts.scoreMinSearchTermMatchRatio
  })

  // Now reduce the searchScore by the ratio of search terms found vs. search terms given
  results = results.map((el) => {
    const searchTermMatchRatio = Object.keys(el.searchTermMatches).length / searchTermArray.length
    return {
      ...el,
      searchScore: el.searchScore * searchTermMatchRatio,
    }
  })

  return results
}
