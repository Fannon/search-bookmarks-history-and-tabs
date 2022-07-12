//////////////////////////////////////////
// FUZZY SEARCH SUPPORT                 //
//////////////////////////////////////////

// @see https://fusejs.io/

/**
 * Uses Fuse.js to do a fuzzy search
 *
 * @see https://fusejs.io/
 */
export async function fuzzySearch(searchMode, searchTerm) {
  if (searchMode === 'history') {
    return fuzzySearchWithScoring(searchTerm, ext.model.history)
  } else if (searchMode === 'bookmarks') {
    return fuzzySearchWithScoring(searchTerm, ext.model.bookmarks)
  } else if (searchMode === 'tabs') {
    return fuzzySearchWithScoring(searchTerm, ext.model.tabs)
  } else if (searchMode === 'search') {
    return []
  } else {
    return [
      ...fuzzySearchWithScoring(searchTerm, ext.model.bookmarks),
      ...fuzzySearchWithScoring(searchTerm, ext.model.tabs),
      ...fuzzySearchWithScoring(searchTerm, ext.model.history),
    ]
  }
}

/**
 * Fuzzy search algorithm
 * Uses https://www.npmjs.com/package/fuzzysort
 */
function fuzzySearchWithScoring(searchTerm, data) {
  /** Search results */
  const results = []

  // Score with fuzzysort is difficult to handle.
  // We assume that the worst score we allow is -500.000
  // and normalize score between this and 0
  const scoreNormalizationFactor = -500000

  const searchResults = fuzzysort.go(searchTerm, data, {
    key: 'searchString',
    limit: ext.opts.searchMaxResults,
    // subtracting 1, otherwise the library will get confused by -0
    threshold: ext.opts.searchFuzzyness * scoreNormalizationFactor - 1,
  })

  for (const result of searchResults) {
    // Calculate Score
    result.obj.score = normalize(result.score, 0, scoreNormalizationFactor)

    // Apply highlighting
    const highlight = fuzzysort.highlight(result, '<mark>', '</mark>')
    const highlightArray = highlight.split(' ° ')
    if (highlightArray[0].includes('<mark>')) {
      result.obj.titleHighlighted = highlightArray[0]
    }
    if (highlightArray[1].includes('<mark>')) {
      result.obj.urlHighlighted = highlightArray[1]
    }
    if (highlightArray[2] && highlightArray[2].includes('<mark>')) {
      result.obj.tagsHighlighted = highlightArray[2]
    }
    if (highlightArray[3] && highlightArray[3].includes('<mark>')) {
      result.obj.folderHighlighted = highlightArray[3]
    }

    results.push(result.obj)
  }

  return results
}

/**
 * Normalizes a number value according to max and min range
 */
function normalize(val, max, min) {
  return (val - min) / (max - min)
}
