//////////////////////////////////////////
// SIMPLE SEARCH SUPPORT                //
//////////////////////////////////////////

/**
 * Memoize some state, to avoid re-creating haystack and fuzzy search instances
 */
let state = {}

/**
 * Resets state for simple search. Necessary when search data changes or search string is reset.
 */
export function resetSimpleSearchState(searchMode) {
  if (searchMode) {
    state[searchMode] = undefined
  }
}

export function simpleSearch(searchMode, searchTerm) {
  let results = []
  if (searchMode === 'history' || searchMode === 'bookmarks' || searchMode === 'tabs') {
    return simpleSearchWithScoring(searchTerm, searchMode)
  } else if (searchMode === 'search') {
    // nothing, because search will be added later
  } else {
    results.push(...simpleSearchWithScoring(searchTerm, 'bookmarks'))
    results.push(...simpleSearchWithScoring(searchTerm, 'tabs'))
    results.push(...simpleSearchWithScoring(searchTerm, 'history'))
  }
  return results
}

/**
 * Very simple search algorithm :)
 * This does an `includes` search with an AND condition between the terms
 *
 * TODO: Right now there is no real scoring, so everything has base score of 1
 */
function simpleSearchWithScoring(searchTerm, searchMode) {
  const results = []

  if (!state[searchMode]) {
    state[searchMode] = {
      cachedData: ext.model[searchMode],
    }
  }

  const s = state[searchMode]

  // Invalidate s.cachedData if the new search term is not just an extension of the last one
  if (s.searchTerm && !searchTerm.startsWith(s.searchTerm)) {
    s.cachedData = ext.model[searchMode]
  }

  let searchTermArray = searchTerm.split(' ')

  if (s.cachedData && searchTermArray.length) {
    for (const entry of s.cachedData) {
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

  s.cachedData = results
  s.searchTerm = searchTerm

  return results
}
