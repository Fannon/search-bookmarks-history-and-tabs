/**
 * @file Implements the popup's fuzzy/approximate-match search via uFuzzy.
 *
 * Strategy:
 * - Lazy-load uFuzzy on first use to keep initial bundle size low.
 * - Build memoized haystacks per mode (bookmarks, tabs, history) for quick repeated searches.
 * - Handle typo tolerance, loose word boundaries, and non-ASCII fallbacks better than the simple strategy.
 *
 * Scoring pipeline:
 * - uFuzzy returns a searchScore between 0 and 1 representing match quality.
 * - Higher searchScore values indicate closer matches; `scoring.js` multiplies base weights by this factor.
 * - Highlight data is preserved for the view to underline matched substrings once results render.
 */

import { escapeHtml, loadScript } from '../helper/utils.js'
import { printError } from '../view/errorView.js'
import { resolveSearchTargets } from './common.js'

const nonASCIIRegex = /[\u0080-\uFFFF]/

/** Memoize some state, to avoid re-creating haystack and fuzzy search instances. */
let state = {}

/**
 * Resets state for fuzzy search. Necessary when search data changes or search string is reset.
 * If searchMode is given, will only reset that particular state.
 * If no searchMode is given, resets all state.
 *
 * @param {string} [searchMode] - Optional mode to reset; resets all when omitted.
 */
export function resetFuzzySearchState(searchMode) {
  if (searchMode) {
    state[searchMode] = undefined
  } else {
    state = {}
  }
}

/**
 * Execute fuzzy search across the datasets mapped to the active mode.
 *
 * @param {string} searchMode - Active search mode.
 * @param {string} searchTerm - Query string.
 * @returns {Promise<Array<Object>>} Matching entries with fuzzy scores.
 */
export async function fuzzySearch(searchMode, searchTerm, data, options) {
  // Lazy load the uFuzzy library if not there already
  if (!window.uFuzzy) {
    try {
      await loadScript('./lib/uFuzzy.iife.min.js')
    } catch (err) {
      printError(err, 'Could not load uFuzzy')
    }
  }

  const targets = resolveSearchTargets(searchMode)
  if (!targets.length) {
    return []
  }

  const results = []
  for (const target of targets) {
    results.push(...fuzzySearchWithScoring(searchTerm, target, data[target], options))
  }
  return results
}

/**
 * Execute a fuzzy search with additional scoring and highlighting of results
 *
 * @param {string} searchTerm - Query string.
 * @param {string} searchMode - Dataset key inside `ext.model`.
 * @returns {Array<Object>} Fuzzy search matches with scores.
 */
function fuzzySearchWithScoring(searchTerm, searchMode, data, opts) {
  if (!data || !data.length) {
    return [] // early return
  }

  if (!state[searchMode]) {
    state[searchMode] = {
      haystack: new Array(data.length),
    }
    for (let i = 0; i < data.length; i++) {
      state[searchMode].haystack[i] = data[i].searchString
    }
  }

  const s = state[searchMode]

  // (Re-)create uFuzzy instance if needed
  const isNonASCII = containsNonASCII(searchTerm)
  if (!s.uf || s.isNonASCII !== isNonASCII) {
    const searchFuzzyness = opts.searchFuzzyness
    const options = {
      intraIns: Math.round(searchFuzzyness * 4.2),
      ...(opts.uFuzzyOptions || {}),
    }

    if (isNonASCII) {
      options.interSplit = '(p{Unified_Ideograph=yes})+'
    }

    if (searchFuzzyness >= 0.8) {
      options.intraMode = 1
      options.intraSub = 1
      options.intraTrn = 1
      options.intraDel = 1
    }

    s.uf = new uFuzzy(options)
    s.isNonASCII = isNonASCII
  }

  /** Search results */
  let results = []

  // Invalidate s.idxs cache if the new search term is not just an extension of the last one
  if (s.searchTerm && !searchTerm.startsWith(s.searchTerm)) {
    s.idxs = undefined
  }

  const searchTermArray = searchTerm.split(' ')

  for (const term of searchTermArray) {
    if (!term) continue // Skip empty terms

    const localResults = []

    try {
      const idxs = s.uf.filter(s.haystack, term, s.idxs)
      const info = s.uf.info(idxs, s.haystack, term)

      for (let i = 0; i < info.idx.length; i++) {
        const result = data[idxs[i]]

        localResults.push({
          ...result,
          // 0 intra chars are perfect score, 5 and more are 0 score.
          searchScore: Math.max(0, 1 * (1 - info.intraIns[i] / 5)),
          searchApproach: 'fuzzy',
          fuzzyRanges: info.ranges[i], // Store ranges for deferred highlighting
        })
      }

      s.idxs = idxs // Save idxs cache to state
    } catch (err) {
      err.message = 'Fuzzy search could not handle search term. Please try precise search instead.'
      printError(err)
    }

    results = localResults // keep and return the last iteration of local results
    if (!results.length) {
      break // Early termination if no matches found
    }
  }

  s.searchTerm = searchTerm // Remember last search term, to know when to invalidate idxx cache
  return results
}

/**
 * Highlighting stage for fuzzy search matches.
 * Uses the pre-calculated ranges from the search phase.
 *
 * @param {Array<Object>} results - The subset of results to highlight.
 * @returns {Array<Object>} Results with `highlightedTitle` and `highlightedUrl`.
 */
export function highlightFuzzySearch(results) {
  if (!results.length) {
    return results
  }

  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    if (!r.fuzzyRanges) {
      r.highlightedTitle = escapeHtml(r.title || r.url || '')
      r.highlightedUrl = escapeHtml(r.url || '')
      continue
    }

    // Use uFuzzy.highlight with the ranges we carried from the search phase
    const highlightedHaystack = uFuzzy.highlight(r.searchString, r.fuzzyRanges, (part, matched) =>
      matched ? `«${part}»` : part,
    )
    const safeHighlighted = escapeHtml(highlightedHaystack).replaceAll('«', '<mark>').replaceAll('»', '</mark>')
    const [highlightedTitle, highlightedUrl] = safeHighlighted.split('¦')

    r.highlightedTitle = highlightedTitle
    r.highlightedUrl = highlightedUrl || ''
  }

  return results
}

/**
 * Detect whether a string contains non-ASCII characters that require special fuzzy handling.
 *
 * @param {string} str - Value to inspect.
 * @returns {boolean} True when non-ASCII characters are present.
 */
function containsNonASCII(str) {
  return nonASCIIRegex.test(str)
}
