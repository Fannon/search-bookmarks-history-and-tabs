//////////////////////////////////////////
// FUSE.JS SUPPORT                      //
//////////////////////////////////////////

// @see https://fusejs.io/

/**
 * Creates fuzzy search indexes with fuse.js
 */
export function createFuzzyIndexes() {
  if (ext.opts.tabs.enabled && !ext.index.fuzzy.tabs) {
    ext.index.fuzzy.tabs = createFuseJsIndex('tabs', ext.model.tabs)
  }
  if (ext.opts.bookmarks.enabled && !ext.index.fuzzy.bookmarks ) {
    ext.index.fuzzy.bookmarks = createFuseJsIndex('bookmarks', ext.model.bookmarks)
  }
  if (ext.opts.history.enabled && !ext.index.fuzzy.history) {
    ext.index.fuzzy.history = createFuseJsIndex('history', ext.model.history)
  }
}

/**
 * Initialize search with Fuse.js
 */
function createFuseJsIndex(type, searchData) {
  performance.mark('index-start')
  const options = {
    includeScore: true,
    includeMatches: true,
    ignoreLocation: true,
    findAllMatches: true,
    shouldSort: false,
    minMatchCharLength: ext.opts.search.minMatchCharLength,
    threshold: ext.opts.search.fuzzyness,
    keys: [{
      name: 'title',
      weight: ext.opts.score.titleWeight,
    }, {
      name: 'url',
      weight: ext.opts.score.urlWeight,
    }]
  }

  if (type === 'bookmarks') {
    options.keys.push({
      name: 'tags',
      weight: ext.opts.score.tagWeight,
    }, {
      name: 'folder',
      weight: ext.opts.score.folderWeight,
    })
  }

  const index = new window.Fuse(searchData, options)

  performance.mark('index-end')
  performance.measure('index-fusejs-' + type, 'index-start', 'index-end')
  return index
}

/**
 * Uses Fuse.js to do a fuzzy search
 * 
 * @see https://fusejs.io/
 */
export async function searchWithFuseJs(searchTerm, searchMode) {

  let results = []
  
  // If the search term is below minMatchCharLength, no point in starting search
  if (searchTerm.length < ext.opts.search.minMatchCharLength) {
    return results
  }

  performance.mark('search-start')

  searchMode = searchMode || 'all'
  searchTerm = searchTerm.toLowerCase()

  console.debug(`Searching with approach="fuzzy" and mode="${searchMode}" for searchTerm="${searchTerm}"`)

  if (searchMode === 'history' && ext.index.fuzzy.history) {
    results = ext.index.fuzzy.history.search(searchTerm)
  } else if (searchMode === 'bookmarks' && ext.index.fuzzy.bookmarks) {
    results = ext.index.fuzzy.bookmarks.search(searchTerm)
  } else if (searchMode === 'tabs' && ext.index.fuzzy.tabs) {
    results = ext.index.fuzzy.tabs.search(searchTerm)
  } else if (searchMode === 'search' && ext.index.fuzzy.tabs) {
    // nothing, because search will be added later
  } else {
    if (ext.index.fuzzy.bookmarks) {
      results.push(...ext.index.fuzzy.bookmarks.search(searchTerm))
    }
    if (ext.index.fuzzy.tabs) {
      results.push(...ext.index.fuzzy.tabs.search(searchTerm))
    }
    if (ext.index.fuzzy.history) {
      results.push(...ext.index.fuzzy.history.search(searchTerm))
    }
  }

  // Convert search results into result format view model
  results = results.map((el) => {
    const highlighted = ext.opts.general.highlight ? highlightResultItem(el) : {}
    return {
      ...el.item,
      searchScore: (1 - el.score),
      titleHighlighted: highlighted.title,
      tagsHighlighted: highlighted.tags,
      urlHighlighted: highlighted.url,
      folderHighlighted: highlighted.folder,
    }
  })

  performance.mark('search-end')
  performance.measure('search-fusejs: ' + searchTerm, 'search-start', 'search-end')
  const searchPerformance = performance.getEntriesByType("measure")
  console.debug('Search Performance (fuse.js): ' + searchPerformance[0].duration + 'ms', searchPerformance)
  performance.clearMeasures()

  return results
}

/**
 * Inspired from https://github.com/brunocechet/Fuse.js-with-highlight/blob/master/index.js 
 */
function highlightResultItem(resultItem) {
  const highlightedResultItem = {}
  for (const matchItem of resultItem.matches) {

    const text = resultItem.item[matchItem.key]
    const result = []
    const matches = [].concat(matchItem.indices)
    let pair = matches.shift()

    for (let i = 0; i < text.length; i++) {
      const char = text.charAt(i)
      if (pair && i == pair[0]) {
        result.push('<mark>')
      }
      result.push(char)
      if (pair && i == pair[1]) {
        result.push('</mark>')
        pair = matches.shift()
      }
    }
    highlightedResultItem[matchItem.key] = result.join('')

    // TODO: Didn't try recursion if it works
    if (resultItem.children && resultItem.children.length > 0) {
      resultItem.children.forEach((child) => {
        highlightedResultItem[matchItem.key] = highlightResultItem(child)
      })
    }
  }

  return highlightedResultItem
}
