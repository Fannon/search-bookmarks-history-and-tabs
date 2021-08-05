// @see https://fusejs.io/

/**
 * Initialize search with Fuse.js
 */
export function createFuseJsIndex(type, searchData) {
  performance.mark('index-start')
  const options = {
    includeScore: true,
    includeMatches: true,
    ignoreLocation: true,
    findAllMatches: true,
    useExtendedSearch: true,
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

  performance.mark('search-start')

  searchMode = searchMode || 'all'
  searchTerm = searchTerm.toLowerCase()
  let results = []

  console.debug(`Searching with approach="fuzzy" and mode="${searchMode}" for searchTerm="${searchTerm}"`)

  if (searchMode === 'history' && ext.data.historyIndex) {
    results = ext.data.historyIndex.search(searchTerm)
  } else if (searchMode === 'bookmarks' && ext.data.bookmarkIndex) {
    results = ext.data.bookmarkIndex.search(searchTerm)
  } else if (searchMode === 'tabs' && ext.data.tabIndex) {
    results = ext.data.tabIndex.search(searchTerm)
  } else if (searchMode === 'search' && ext.data.tabIndex) {
    // nothing, because search will be added later
  } else {
    if (ext.data.bookmarkIndex) {
      results.push(...ext.data.bookmarkIndex.search(searchTerm))
    }
    if (ext.data.tabIndex) {
      results.push(...ext.data.tabIndex.search(searchTerm))
    }
    if (ext.data.historyIndex) {
      results.push(...ext.data.historyIndex.search(searchTerm))
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
