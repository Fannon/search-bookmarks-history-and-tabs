//////////////////////////////////////////
// FLEXSEARCH SUPPORT                   //
//////////////////////////////////////////

// @see https://github.com/nextapps-de/flexsearch

/**
 * Creates precise search indexes with flexsearch
 */
export function createPreciseIndexes() {
  if (ext.opts.tabs.enabled && !ext.index.precise.tabs) {
    ext.index.precise.tabs = createFlexSearchIndex('tabs', ext.model.tabs)
  }
  if (ext.opts.bookmarks.enabled && !ext.index.precise.bookmarks) {
    ext.index.precise.bookmarks = createFlexSearchIndex('bookmarks', ext.model.bookmarks)
  }
  if (ext.opts.history.enabled && !ext.index.precise.history) {
    ext.index.precise.history = createFlexSearchIndex('history', ext.model.history)
  }
}

/**
 * Creates flexsearch index of a specific type
 */
export function createFlexSearchIndex(type, searchData) {
  performance.mark('index-start')

  const indexOptions = {
    tokenize: 'forward',
    encoder: 'simple',
    matcher: {
      // "-": " ", // Useful?
      '_': ' ',
      '/': ' ',
    },
    minlength: ext.opts.search.minMatchCharLength,
  }

  if (ext.opts.search.matchAlgorithm === 'includes') {
    indexOptions.tokenize = 'full'
  }

  const indexes = {}
  indexes.title = new FlexSearch.Index(indexOptions)
  indexes.url = new FlexSearch.Index(indexOptions)

  if (type === 'bookmarks') {
    indexes.tag = new FlexSearch.Index(indexOptions)
    indexes.folder = new FlexSearch.Index(indexOptions)
  }

  for (const entry of searchData) {
    indexes.title.add(entry.index, entry.title)
    indexes.url.add(entry.index, entry.url)

    if (type === 'bookmarks') {
      indexes.tag.add(entry.index, entry.tags)
      indexes.folder.add(entry.index, entry.folder)
    }
  }

  performance.mark('index-end')
  performance.measure('index-flexsearch-' + type, 'index-start', 'index-end')
  return indexes
}

/**
 * Search with the flexsearch library
 *
 * @see https://github.com/nextapps-de/flexsearch
 */
export function searchWithFlexSearch(searchTerm, searchMode) {
  let results = []

  // If the search term is below minMatchCharLength, no point in starting search
  if (searchTerm.length < ext.opts.search.minMatchCharLength) {
    return results
  }

  performance.mark('search-start')

  searchMode = searchMode || 'all'
  searchTerm = searchTerm.toLowerCase()

  console.debug(`Searching with approach="precise" and mode="${searchMode}" for searchTerm="${searchTerm}"`)

  if (searchMode === 'history' && ext.index.precise.history) {
    results = flexSearchWithScoring('history', searchTerm, ext.model.history)
  } else if (searchMode === 'bookmarks' && ext.index.precise.bookmarks) {
    results = flexSearchWithScoring('bookmarks', searchTerm, ext.model.bookmarks)
  } else if (searchMode === 'tabs' && ext.index.precise.tabs) {
    results = flexSearchWithScoring('tabs', searchTerm, ext.model.tabs)
  } else if (searchMode === 'search') {
    // nothing, because search will be added later
  } else {
    if (ext.index.precise.bookmarks) {
      results.push(...flexSearchWithScoring('bookmarks', searchTerm, ext.model.bookmarks))
    }
    if (ext.index.precise.tabs) {
      results.push(...flexSearchWithScoring('tabs', searchTerm, ext.model.tabs))
    }
    if (ext.index.precise.history) {
      results.push(...flexSearchWithScoring('history', searchTerm, ext.model.history))
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
function flexSearchWithScoring(indexName, searchTerm, data) {
  const index = ext.index.precise[indexName]

  /** Dictionary to hold all search matches, grouped by search term and field name */
  const matchesDict = {}

  // Simulate an OR search with the terms in searchTerm, separated by spaces
  let searchTermArray = searchTerm.split(' ')
  // filter out all search terms that do not match the min char match length
  searchTermArray = searchTermArray.filter((el) => el.length >= ext.opts.search.minMatchCharLength)

  if (!searchTermArray.length) {
    // Early return if none of the search terms have enough char length
    return []
  }

  let overallMatchCounter = 0
  for (const term of searchTermArray) {
    matchesDict[term] = {}

    // Search title field
    matchesDict[term].title = index.title.search(term, ext.opts.search.maxResults)

    // Search url field
    matchesDict[term].url = index.url.search(term, ext.opts.search.maxResults)

    // search tags if available (only bookmars)
    if (index.tag) {
      matchesDict[term].tag = index.tag.search(term, ext.opts.search.maxResults)
    }

    // search folder if available (only bookmars)
    if (index.folder) {
      matchesDict[term].folder = index.folder.search(term, ext.opts.search.maxResults)
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

      for (const matchIndex of matches) {
        const el = data[matchIndex]

        if (!resultDict[matchIndex]) {
          resultDict[matchIndex] = {
            searchScore: ext.opts.score[`${field}Weight`],
            searchTermMatches: {},
            ...el,
          }
        } else {
          // Result is already there, we just need to update the score and counters
          let searchScore = ext.opts.score[`${field}Weight`]
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
    return searchTermMatchRatio >= ext.opts.score.minSearchTermMatchRatio
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
