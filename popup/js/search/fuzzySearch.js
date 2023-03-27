//////////////////////////////////////////
// FUZZY SEARCH SUPPORT                 //
//////////////////////////////////////////

/**
 * Memoize some state, to avoid re-creating haystack and fuzzy search instances
 */
let state = {}

/**
 * Resets state for fuzzy search. Necessary when search data changes or search string is reset.
 * If searchMode is given, will only reset that particular state.
 * Otherwise state will be reset entirely.
 */
export function resetFuzzySearchState(searchMode) {
  if (searchMode) {
    state[searchMode] = undefined
  }
}

/**
 * Uses uFuzzy to do a fuzzy search
 *
 * @see https://github.com/leeoniya/uFuzzy
 */
export async function fuzzySearch(searchMode, searchTerm) {
  if (searchMode === 'history' || searchMode === 'bookmarks' || searchMode === 'tabs') {
    return fuzzySearchWithScoring(searchTerm, searchMode)
  } else if (searchMode === 'search') {
    return []
  } else {
    return [
      ...fuzzySearchWithScoring(searchTerm, 'bookmarks'),
      ...fuzzySearchWithScoring(searchTerm, 'tabs'),
      ...fuzzySearchWithScoring(searchTerm, 'history'),
    ]
  }
}

/**
 * Execute a fuzzy search with additional scoring and highlighting of results
 */
function fuzzySearchWithScoring(searchTerm, searchMode) {
  const data = ext.model[searchMode]

  if (!data.length) {
    return [] // early return
  }

  if (!state[searchMode]) {
    const options = {
      // How many characters "in between" are allowed -> increased fuzzyness
      intraIns: Math.round(ext.opts.searchFuzzyness * 4.2),
      interSplit: '(p{Unified_Ideograph=yes})+',
    }

    // When searchFuzzyness is set to 0.8 or higher:
    // allows for a single error in each term of the search phrase
    // @see https://github.com/leeoniya/uFuzzy#how-it-works
    if (ext.opts.searchFuzzyness >= 0.8) {
      options.intraMode = 1
      options.intraSub = 1 // substitution (replacement)
      options.intraTrn = 1 // transposition (swap), insertion (addition)
      options.intraDel = 1 // deletion (omission)
    }

    state[searchMode] = {
      haystack: data.map((el) => {
        return el.searchString
      }),
      uf: new uFuzzy(options),
    }
  }

  /** Search results */
  let results = []
  const s = state[searchMode]

  // Invalidate s.idxs cache if the new search term is not just an extension of the last one
  if (s.searchTerm && !searchTerm.startsWith(s.searchTerm)) {
    s.idxs = undefined
  }

  let searchTermArray = searchTerm.split(' ')

  for (const term of searchTermArray) {
    const localResults = []

    let idxs = s.uf.filter(s.haystack, term, s.idxs)
    let info = s.uf.info(idxs, s.haystack, term)

    for (let i = 0; i < info.idx.length; i++) {
      const result = data[idxs[i]]

      // Apply highlighting, but only on last iteration
      const highlight = uFuzzy.highlight(result.searchString, info.ranges[i])
      // Split highlighted string back into its original multiple properties
      const highlightArray = highlight.split('¦')
      if (highlightArray[0].includes('<mark>')) {
        result.titleHighlighted = highlightArray[0]
      }
      if (highlightArray[1].includes('<mark>')) {
        result.urlHighlighted = highlightArray[1]
      }
      if (highlightArray[2] && highlightArray[2].includes('<mark>')) {
        result.tagsHighlighted = highlightArray[2]
      }
      if (highlightArray[3] && highlightArray[3].includes('<mark>')) {
        result.folderHighlighted = highlightArray[3]
      }

      localResults.push({
        ...result,
        // 0 intra chars are perfect score, 5 and more are 0 score.
        searchScore: Math.max(0, 1 * (1 - info.intraIns[i] / 5)),
        searchApproach: 'fuzzy',
      })
      s.idxs = idxs // Save idxs cache to state
    }

    results = localResults // keep and return the last iteration of local results
  }

  s.searchTerm = searchTerm // Remember last search term, to know when to invalidate idxx cache
  return results
}
