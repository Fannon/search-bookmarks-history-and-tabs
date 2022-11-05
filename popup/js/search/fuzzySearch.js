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
  const haystack = data.map((el) => {
    return el.searchString
  })

  let uf = new uFuzzy({
    // How many characters "in between" are allowed -> increased fuzzyness
    intraIns: Math.round(ext.opts.searchFuzzyness * 4.2),
  })
  let idxs = uf.filter(haystack, searchTerm)
  let info = uf.info(idxs, haystack, searchTerm)

  for (let i = 0; i < info.idx.length; i++) {
    const result = data[idxs[i]]

    // // Apply highlighting
    const highlight = uFuzzy.highlight(result.searchString, info.ranges[i])
    console.log(highlight)
    const highlightArray = highlight.split(' ° ')
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

    results.push({
      ...result,
      // 0 intra chars are perfect score, 5 and more are 0 score.
      searchScore: Math.max(0, 1 * (1 - info.intraIns[i] / 5)),
      searchApproach: 'fuzzy',
    })
  }

  return results
}
