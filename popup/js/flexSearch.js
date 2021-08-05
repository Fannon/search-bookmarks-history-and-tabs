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
    // encode: "advanced",
    // optimize: false,
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

  if (searchMode === 'history' && ext.data.historyIndexFlex) {
    results = flexSearchWithScoring(ext.data.historyIndexFlex, searchTerm, ext.data.searchData.history)
  } else if (searchMode === 'bookmarks' && ext.data.bookmarkIndexFlex) {
    results = flexSearchWithScoring(ext.data.bookmarkIndexFlex, searchTerm, ext.data.searchData.bookmarks)
  } else if (searchMode === 'tabs' && ext.data.tabIndexFlex) {
    results = flexSearchWithScoring(ext.data.tabIndexFlex, searchTerm, ext.data.searchData.tabs)
  } else if (searchMode === 'search') {
    // nothing, because search will be added later
  } else {
    if (ext.data.bookmarkIndexFlex) {
      results.push(...flexSearchWithScoring(ext.data.bookmarkIndexFlex, searchTerm, ext.data.searchData.bookmarks))
    }
    if (ext.data.tabIndexFlex) {
      results.push(...flexSearchWithScoring(ext.data.tabIndexFlex, searchTerm, ext.data.searchData.tabs))
    }
    if (ext.data.historyIndexFlex) {
      results.push(...flexSearchWithScoring(ext.data.historyIndexFlex, searchTerm, ext.data.searchData.history))
    }
  }

  // Convert search results into result format view model
  results = results.map((el) => {
    // TODO: Highlight results with flexsearch missing
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

    // TODO: This can be improved for sure. To behave like a "compressor" algorithm
    const titleIndex = titleMatches.indexOf(matchId)
    if (titleIndex > -1) {
      const titleMatchScore = (((titleMatches.length - titleIndex) / titleMatches.length / 5) + 0.8) * ext.opts.score.titleWeight
      searchScore = Math.max(searchScore, titleMatchScore)
      // console.log(`id: ${matchId}, title: ${el.title} -> titleMatches score: ${searchScore}`, titleMatches)
    }
    const urlIndex = urlMatches.indexOf(matchId)
    if (urlIndex > -1) {
      const urlMatchScore = (((urlMatches.length - urlIndex) / urlMatches.length / 5) + 0.8) * ext.opts.score.urlWeight
      searchScore = Math.max(searchScore, urlMatchScore)
      // console.log(`id: ${matchId}, title: ${el.title} -> urlMatches score: ${urlMatchScore} (${searchScore})`, titleMatches)
    }
    const tagIndex = tagMatches.indexOf(matchId)
    if (tagIndex > -1) {
      const tagMatchScore = (((tagMatches.length - tagIndex) / tagMatches.length / 5) + 0.8) * ext.opts.score.tagWeight
      searchScore = Math.max(searchScore, tagMatchScore)
      // console.log(`id: ${matchId}, title: ${el.title} -> tagMatches score: ${searchScore}`, titleMatches)
    }
    const folderIndex = urlMatches.indexOf(matchId)
    if (folderIndex > -1) {
      const folderMatchScore = (((urlMatches.length - folderIndex) / urlMatches.length / 5) + 0.8) * ext.opts.score.folderWeight
      searchScore = Math.max(searchScore, folderMatchScore)
      // console.log(`id: ${matchId}, title: ${el.title} -> urlMatches score: ${searchScore}`, titleMatches)
    }

    results.push({
      searchScore: searchScore,
      item: el,
    })
  }

  console.log(results)

  return results
}

function calculateFlexScoreForField(fieldType, matches, matchId, oldScore) {
  const index = matches.indexOf(matchId)
    if (index > -1) {
      const fieldMatchScore = (((index.length - index) / index.length / 5) + 0.8) * ext.opts.score[fieldType + 'Weight']
      console.log(`FieldScore (${fieldType}) of "${el.title}" -> ${fieldMatchScore}/${Math.max(oldScore, fieldMatchScore)}`)
      return Math.max(oldScore, fieldMatchScore)
    }
}
