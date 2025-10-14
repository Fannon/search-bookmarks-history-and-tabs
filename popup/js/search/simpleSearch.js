//////////////////////////////////////////
// SIMPLE SEARCH SUPPORT                //
//////////////////////////////////////////

import { resolveSearchTargets } from './searchTargets.js'

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
  const targets = resolveSearchTargets(searchMode)
  if (!targets.length) {
    return [] // nothing, because search will be added later
  }

  if (targets.length === 1) {
    return simpleSearchWithScoring(searchTerm, targets[0])
  }

  const results = []
  for (const target of targets) {
    results.push(...simpleSearchWithScoring(searchTerm, target))
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
      cachedData: prepareSearchData(data),
    }
  }
  const s = state[searchMode]

  // Invalidate s.cachedData if the new search term is not just an extension of the last one
  if (s.searchTerm && !searchTerm.startsWith(s.searchTerm)) {
    s.cachedData = prepareSearchData(data)
  }

  if (!s.cachedData.length) {
    return [] // early return -> no data left to search
  }

  const searchTermArray = searchTerm.split(' ')

  for (const term of searchTermArray) {
    const localResults = []
    for (const entry of s.cachedData) {
      const normalizedSearchString = entry.searchStringLower || entry.searchString.toLowerCase()
      if (normalizedSearchString.includes(term)) {
        localResults.push({
          ...entry,
          searchScore: 1,
          searchApproach: 'precise',
        })
      }
    }
    s.cachedData = localResults // reduce cachedData set -> improves performance
    if (!s.cachedData.length) {
      break
    }
  }

  s.searchTerm = searchTerm
  return s.cachedData
}
