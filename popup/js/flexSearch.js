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
  if (ext.opts.history.enabled &&!ext.index.precise.history) {
    ext.index.precise.history = createFlexSearchIndex('history', ext.model.history)
  }
}

/**
 * Creates flexsearch index of a specific type
 */
export function createFlexSearchIndex(type, searchData) {
  performance.mark('index-start')

  const indexOptions = {
    preset: 'match',
    tokenize: 'forward',
    minlength: ext.opts.search.minMatchCharLength,
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
    results = flexSearchWithScoring(ext.index.precise.history, searchTerm, ext.model.history)
  } else if (searchMode === 'bookmarks' && ext.index.precise.bookmarks) {
    results = flexSearchWithScoring(ext.index.precise.bookmarks, searchTerm, ext.model.bookmarks)
  } else if (searchMode === 'tabs' && ext.index.precise.tabs) {
    results = flexSearchWithScoring(ext.index.precise.tabs, searchTerm, ext.model.tabs)
  } else if (searchMode === 'search') {
    // nothing, because search will be added later
  } else {
    if (ext.index.precise.bookmarks) {
      results.push(...flexSearchWithScoring(ext.index.precise.bookmarks, searchTerm, ext.model.bookmarks))
    }
    if (ext.index.precise.tabs) {
      results.push(...flexSearchWithScoring(ext.index.precise.tabs, searchTerm, ext.model.tabs))
    }
    if (ext.index.precise.history) {
      results.push(...flexSearchWithScoring(ext.index.precise.history, searchTerm, ext.model.history))
    }
  }

  console.log('Search Results', results)

  performance.mark('search-end')
  performance.measure('search-flexsearch: ' + searchTerm, 'search-start', 'search-end')
  const searchPerformance = performance.getEntriesByType("measure")
  console.debug('Search Performance (flexsearch): ' + searchPerformance[0].duration + 'ms', searchPerformance)
  performance.clearMeasures()

  return results
}

/**
 * Helper function to make a flexsearch search and include the element along with a score
 * This also includes some custom boolean logic how search terms lead to a match across multiple fields
 */
function flexSearchWithScoring(index, searchTerm, data) {

  const matchesDict = {
    title: [],
    url: [],
  }
  if (index.tag) {
    matchesDict.tag = []
  }
  if (index.folder) {
    matchesDict.folder = []
  }

  // Simulate an OR search with the terms in searchTerm, separated by spaces
  let searchTermArray = searchTerm.split(' ')
  // filter out all search terms that do not match the min char match length
  searchTermArray = searchTermArray.filter(el => el.length > ext.opts.search.minMatchCharLength)
  
  let matchCounter = 0
  for (const term of searchTermArray) {
    // Search title field
    const titleMatches = index.title.search(term, ext.opts.search.maxResults)
    matchesDict.title.push(...titleMatches)

    // Search url field
    const urlMatches = index.url.search(term, ext.opts.search.maxResults)
    matchesDict.url.push(...urlMatches)

    // search tags if available (only bookmars)
    let tagMatches = []
    if (index.tag) {
      tagMatches = index.tag.search(term, ext.opts.search.maxResults)
      matchesDict.tag.push(...tagMatches)
    }
    
    // search folder if available (only bookmars)
    let folderMatches = []
    if (index.folder) {
      folderMatches = index.folder.search(term, ext.opts.search.maxResults)
      matchesDict.folder.push(...folderMatches)
    }

    // Count how many individual search terms we have found across all the fields
    if (titleMatches.length + urlMatches.length + tagMatches.length + folderMatches.length) {
      matchCounter += 1
    }
  }

  // We need to have at least one field match per search term to have an overall match 
  if (matchCounter < searchTermArray.length) {
    return []
  }

  const resultDict = {}

  for (const field in matchesDict) {
    const matches = matchesDict[field]
    
    for (const matchIndex of matches) {
      const el = data[matchIndex]
      const searchResult = {
        searchScore: ext.opts.score[`${field}Weight`],
        ...el
      }

      if (!resultDict[matchIndex]) {
        resultDict[matchIndex] = searchResult
      } else if (resultDict[matchIndex].searchScore < searchResult.searchScore) {
        resultDict[matchIndex] = searchResult
      } else {
        // Add a tiny bit of the search score if we have matches in more than just one field
        resultDict[matchIndex].searchScore += searchResult.searchScore / 10
      }
    }
  }

  return Object.values(resultDict)
}
