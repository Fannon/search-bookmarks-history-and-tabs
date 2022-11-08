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
 * There is no real scoring, everything has base score of 1
 */
function simpleSearchWithScoring(searchTerm, searchMode) {
  const data = ext.model[searchMode]
  if (!data.length) {
    return [] // early return -> no data to search
  }

  if (!state[searchMode]) {
    state[searchMode] = {
      cachedData: [...data],
    }
  }
  const s = state[searchMode]

  // Invalidate s.cachedData if the new search term is not just an extension of the last one
  if (s.searchTerm && !searchTerm.startsWith(s.searchTerm)) {
    s.cachedData = [...data]
  }

  if (!s.cachedData.length) {
    return [] // early return -> no data left to search
  }

  let searchTermArray = searchTerm.split(' ')

  for (const term of searchTermArray) {
    const localResults = []
    for (const entry of s.cachedData) {
      if (entry.searchString.toLowerCase().includes(term)) {
        localResults.push({
          ...entry,
          searchScore: 1,
          searchApproach: 'precise',
        })
      }
      s.cachedData = localResults // reduce cachedData set -> improves performance
    }
  }

  s.searchTerm = searchTerm
  return s.cachedData
}
