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

function prepareSearchData(data) {
  return data.map((entry) => {
    if (!entry.searchStringLower) {
      entry.searchStringLower = entry.searchString.toLowerCase()
    }
    return entry
  })
}

export function simpleSearch(searchMode, searchTerm) {
  if (searchMode === 'history') {
    return [...simpleSearchWithScoring(searchTerm, 'tabs'), ...simpleSearchWithScoring(searchTerm, 'history')]
  } else if (searchMode === 'bookmarks' || searchMode === 'tabs') {
    return simpleSearchWithScoring(searchTerm, searchMode)
  } else if (searchMode === 'search') {
    return [] // nothing, because search will be added later
  } else {
    return [
      ...simpleSearchWithScoring(searchTerm, 'bookmarks'),
      ...simpleSearchWithScoring(searchTerm, 'tabs'),
      ...simpleSearchWithScoring(searchTerm, 'history'),
    ]
  }
}

/**
 * Very simple search algorithm :)
 * This does an `includes` search with an AND condition between the terms
 * There is no real scoring, everything has base score of 1
 */
function simpleSearchWithScoring(searchTerm, searchMode) {
  const data = ext.model[searchMode]
  if (!data || !data.length) {
    return [] // early return -> no data to search
  }

  if (!state[searchMode]) {
    state[searchMode] = {
      cachedData: prepareSearchData(data),
    }
  }
  const s = state[searchMode]

  // Invalidate s.cachedData if the new search term is not just an extension of the last one
  if (s.searchTerm && !searchTerm.startsWith(s.searchTerm)) {
    s.cachedData = prepareSearchData(data)
  }

  if (!s.cachedData || !s.cachedData.length) {
    return [] // early return -> no data left to search
  }

  const searchTermArray = searchTerm.split(' ')
  let results = s.cachedData

  // Early termination if no search terms
  if (!searchTermArray.length || !searchTermArray[0]) {
    return results
  }

  for (const term of searchTermArray) {
    if (!term) continue // Skip empty terms

    const localResults = []

    // Optimize string operations by avoiding repeated toLowerCase calls
    for (const entry of results) {
      const normalizedSearchString = entry.searchStringLower || entry.searchString.toLowerCase()

      // Use indexOf for better performance than includes for single terms
      if (normalizedSearchString.indexOf(term) !== -1) {
        localResults.push({
          ...entry,
          searchScore: 1,
          searchApproach: 'precise',
        })
      }
    }

    results = localResults
    if (!results.length) {
      break // Early termination if no matches found
    }
  }

  s.searchTerm = searchTerm
  return results
}
