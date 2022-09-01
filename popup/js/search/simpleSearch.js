//////////////////////////////////////////
// SIMPLE SEARCH SUPPORT                //
//////////////////////////////////////////

export function simpleSearch(searchMode, searchTerm) {
  let results = []
  if (searchMode === 'history') {
    results = simpleSearchWithScoring(searchTerm, ext.model.history)
  } else if (searchMode === 'bookmarks') {
    results = simpleSearchWithScoring(searchTerm, ext.model.bookmarks)
  } else if (searchMode === 'tabs') {
    results = simpleSearchWithScoring(searchTerm, ext.model.tabs)
  } else if (searchMode === 'search') {
    // nothing, because search will be added later
  } else {
    results.push(...simpleSearchWithScoring(searchTerm, ext.model.bookmarks))
    results.push(...simpleSearchWithScoring(searchTerm, ext.model.tabs))
    results.push(...simpleSearchWithScoring(searchTerm, ext.model.history))
  }
  return results
}

/**
 * Very simple search algorithm :)
 * This does an `includes` search with an AND condition between the terms
 *
 * TODO: Right now there is no real scoring, so everything has base score of 1
 */
function simpleSearchWithScoring(searchTerm, data) {
  const results = []

  let searchTermArray = searchTerm.split(' ')

  if (data && searchTermArray.length) {
    for (const entry of data) {
      let searchTermMatches = 0
      for (const term of searchTermArray) {
        if (entry.searchString.toLowerCase().includes(term)) {
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
