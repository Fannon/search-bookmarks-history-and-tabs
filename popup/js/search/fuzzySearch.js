//////////////////////////////////////////
// FUZZY SEARCH SUPPORT                 //
//////////////////////////////////////////

import { loadScript, printError } from '../helper/utils.js'

/** Memoize some state, to avoid re-creating haystack and fuzzy search instances */
let state = {}

/**
 * Resets state for fuzzy search. Necessary when search data changes or search string is reset.
 * If searchMode is given, will only reset that particular state.
 */
export function resetFuzzySearchState(searchMode) {
  if (searchMode) {
    state[searchMode] = undefined
  }
}

export async function fuzzySearch(searchMode, searchTerm) {
  // Lazy load the uFuzzy library if not there already
  if (!window['uFuzzy']) {
    try {
      await loadScript('./lib/uFuzzy.iife.min.js')
    } catch (err) {
      printError(err, 'Could not load uFuzzy')
    }
  }

  if (searchMode === 'history') {
    return [...fuzzySearchWithScoring(searchTerm, 'tabs'), ...fuzzySearchWithScoring(searchTerm, 'history')]
  } else if (searchMode === 'bookmarks' || searchMode === 'tabs') {
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

  if (containsNonASCII(searchTerm)) {
    state[searchMode] = undefined
  }

  if (!state[searchMode]) {
    const options = {
      // How many characters "in between" are allowed -> increased fuzzyness
      intraIns: Math.round(ext.opts.searchFuzzyness * 4.2),
      ...(ext.opts.uFuzzyOptions || {}),
    }

    if (containsNonASCII(searchTerm)) {
      options.interSplit = '(p{Unified_Ideograph=yes})+'
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

    try {
      let idxs = s.uf.filter(s.haystack, term, s.idxs)
      let info = s.uf.info(idxs, s.haystack, term)

      for (let i = 0; i < info.idx.length; i++) {
        const result = data[idxs[i]]

        // Apply highlighting, but only on last iteration
        const highlight = uFuzzy.highlight(result.searchString, info.ranges[i])
        // Split highlighted string back into its original multiple properties
        const highlightArray = highlight.split('¦')
        if (highlightArray[0] && highlightArray[0].includes('<mark>')) {
          result.titleHighlighted = highlightArray[0]
        }
        if (highlightArray[1] && highlightArray[1].includes('<mark>')) {
          result.urlHighlighted = highlightArray[1]
        }

        localResults.push({
          ...result,
          // 0 intra chars are perfect score, 5 and more are 0 score.
          searchScore: Math.max(0, 1 * (1 - info.intraIns[i] / 5)),
          searchApproach: 'fuzzy',
        })
        s.idxs = idxs // Save idxs cache to state
      }
    } catch (err) {
      err.message = 'Fuzzy search could not handle search term. Please try precise search instead.'
      printError(err)
    }

    results = localResults // keep and return the last iteration of local results
  }

  s.searchTerm = searchTerm // Remember last search term, to know when to invalidate idxx cache
  return results
}

function containsNonASCII(str) {
  for (let i = 0; i < str.length; i++) {
    if (str.charCodeAt(i) > 127) {
      return true
    }
  }
  return false
}
