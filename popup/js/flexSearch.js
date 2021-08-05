import { calculateFinalScore } from './search.js'

//////////////////////////////////////////
// FLEXSEARCH SUPPORT                   //
//////////////////////////////////////////

// @see https://github.com/nextapps-de/flexsearch

/**
 * Creates flexsearch index
 */
export function createFlexSearchIndex(type, searchData) {
  performance.mark('index-start')
  const options = {
    preset: 'match',
    tokenize: "forward",
    minlength: ext.opts.search.minMatchCharLength,
    document: {
      id: "index",
      index: [{
        field: "title",
      }, {
        field: 'url',
      }]
    }
  }

  if (type === 'bookmarks') {
    options.document.index.push({ field: 'tags' }, { field: 'folder' })
  }

  const index = new FlexSearch.Document(options)

  for (const entry of searchData) {
    index.add(entry)
  }

  performance.mark('index-end')
  performance.measure('index-flexsearch-' + type, 'index-start', 'index-end')
  return index
}

/**
 * Search with the flexsearch library 
 * 
 * @see https://github.com/nextapps-de/flexsearch
 */
export function searchWithFlexSearch(searchTerm, searchMode) {

  performance.mark('search-start')

  searchMode = searchMode || 'all'
  searchTerm = searchTerm.toLowerCase()
  let results = []

  console.debug(`Searching with approach="precise" and mode="${searchMode}" for searchTerm="${searchTerm}"`)

  if (searchMode === 'history' && ext.index.precise.history) {
    results = flexSearchWithScoring(ext.index.precise.history, searchTerm, ext.data.searchData.history)
  } else if (searchMode === 'bookmarks' && ext.index.precise.bookmarks) {
    results = flexSearchWithScoring(ext.index.precise.bookmarks, searchTerm, ext.data.searchData.bookmarks)
  } else if (searchMode === 'tabs' && ext.index.precise.tabs) {
    results = flexSearchWithScoring(ext.index.precise.tabs, searchTerm, ext.data.searchData.tabs)
  } else if (searchMode === 'search') {
    // nothing, because search will be added later
  } else {
    if (ext.index.precise.bookmarks) {
      results.push(...flexSearchWithScoring(ext.index.precise.bookmarks, searchTerm, ext.data.searchData.bookmarks))
    }
    if (ext.index.precise.tabs) {
      results.push(...flexSearchWithScoring(ext.index.precise.tabs, searchTerm, ext.data.searchData.tabs))
    }
    if (ext.index.precise.history) {
      results.push(...flexSearchWithScoring(ext.index.precise.history, searchTerm, ext.data.searchData.history))
    }
  }

  // Convert search results into result format view model
  results = results.map((el) => {
    const highlighted = ext.opts.general.highlight ? highlightResultItem(el) : {}
    return {
      ...el.item,
      searchScore: el.searchScore,
    }
  })

  performance.mark('search-end')
  performance.measure('search-flexsearch: ' + searchTerm, 'search-start', 'search-end')
  const searchPerformance = performance.getEntriesByType("measure")
  console.debug('Search Performance (flexsearch): ' + searchPerformance[0].duration + 'ms', searchPerformance)
  performance.clearMeasures()

  return results
}

/**
 * Helper function to make a flexsearch search and include the element along with a score
 */
function flexSearchWithScoring(index, searchTerm, data) {

  const results = []

  const searchResults = index.search(searchTerm, ext.opts.search.maxResults, {})

  if (searchResults.length === 0) {
    return results // early return when we have no match anyway
  }

  const titleMatches = searchResults[0] ? searchResults[0].result : []
  const urlMatches = searchResults[1] ? searchResults[1].result : []
  const tagMatches = searchResults[2] ? searchResults[2].result : []
  const folderMatches = searchResults[3] ? searchResults[3].result : []

  const uniqueMatches = [...new Set([
    ...titleMatches,
    ...urlMatches,
    ...tagMatches,
    ...folderMatches,
  ])]

  ext.data.result = []
  for (const matchId of uniqueMatches) {
    const el = data[matchId]

    let searchScore = 0

    searchScore = Math.max(searchScore, calculateFlexScoreForField(titleMatches, matchId, ext.opts.score.titleWeight))
    searchScore = Math.max(searchScore, calculateFlexScoreForField(urlMatches, matchId, ext.opts.score.urlWeight))
    if (el.type === 'bookmark') {
      searchScore = Math.max(searchScore, calculateFlexScoreForField(tagMatches, matchId, ext.opts.score.tagWeight))
      searchScore = Math.max(searchScore, calculateFlexScoreForField(folderMatches, matchId, ext.opts.score.folderWeight))
    }

    results.push({
      searchScore: searchScore,
      item: el,
    })
  }

  return results
}

function calculateFlexScoreForField(matches, matchId, fieldWeight) {
  const index = matches.indexOf(matchId)
  if (index > -1) {
    return (((matches.length - index) / matches.length / 5) + 0.8) * fieldWeight
  } else {
    return 0
  }
}

/**
 * Highlights search matches in results
 */
 function highlightResultItem(resultItem, sarchTerm) {
  const highlightedResultItem = {}
 

  return highlightedResultItem
}
