performance.mark('init-start')

const ext = window.ext = {
  /** Extension options */
  opts: {},
  /** Extension data / model */
  data: {},
}

//////////////////////////////////////////
// OPTIONS                              //
//////////////////////////////////////////

ext.opts.general = {
  /** Extract tags from title and display it as a badge with different search prio */
  tags: true,
  /** Highlight search matches in result */
  highlight: true,
  /** Display  last visit */
  lastVisit: true,
  /**
   * Enables fuse.js extended search, which additional operators to fine-tune results.
   * @see https://fusejs.io/examples.html#weighted-search
   */
  extendedSearch: true,
}
ext.opts.search = {
  maxResults: 128,
  minMatchCharLength: 2,
  /** Fuzzy search threshold (increase to increase fuzziness) */
  threshold: 0.4,
  titleWeight: 10,
  tagWeight: 7,
  urlWeight: 5,
  folderWeight: 2,
}
ext.opts.tabs = {
  enabled: true,
}
ext.opts.bookmarks = {
  enabled: true,
}
ext.opts.history = {
  enabled: true,
  daysAgo: 3,
  maxItems: 128,
}

//////////////////////////////////////////
// INITIALIZE                           //
//////////////////////////////////////////

// Trigger initialization
initExtension().catch((err) => {
  console.error(err)
})

/**
 * Initialize the extension
 * This includes indexing the current bookmarks and history
 */
async function initExtension() {

  console.debug('Initialized with options', ext.opts)

  // HTML Element selectors
  ext.popup = document.getElementById('popup');
  ext.searchInput = document.getElementById('search-input')
  ext.resultList = document.getElementById('result-list')
  ext.searchInput.value = ''

  performance.mark('init-dom')

  // Model / Data
  ext.data = {
    currentItem: 0,
    result: [],
  }

  ext.data.searchData = await getSearchData()

  performance.mark('init-data-load')

  // Initialize fuse.js for fuzzy search
  if (ext.opts.tabs.enabled) {
    ext.data.tabIndex = createFuseJsIndex('tabs', ext.data.searchData.tabs)
  }
  if (ext.opts.bookmarks.enabled) {
    ext.data.bookmarkIndex = createFuseJsIndex('bookmarks', ext.data.searchData.bookmarks)
  }
  if (ext.opts.history.enabled) {
    ext.data.historyIndex = createFuseJsIndex('history', ext.data.searchData.history)
  }

  performance.mark('init-search-index')

  // Register Events
  ext.searchInput.addEventListener("keyup", searchWithFuseJs);
  document.addEventListener("keydown", navigationKeyListener);

  // Do some performance measurements and log it to debug
  performance.mark('init-end')
  performance.measure('init-end-to-end', 'init-start', 'init-end');
  performance.measure('init-dom', 'init-start', 'init-dom');
  performance.measure('init-data-load', 'init-dom', 'init-data-load');
  performance.measure('init-search-index', 'init-data-load', 'init-search-index');
  const initPerformance = performance.getEntriesByType("measure")
  const totalInitPerformance = performance.getEntriesByName("init-end-to-end")
  console.debug('Init Performance: ' + totalInitPerformance[0].duration, initPerformance);
  performance.clearMeasures()
}

/**
 * Initialize search with Fuse.js
 */
function createFuseJsIndex(type, searchData) {
  performance.mark('index-start')
  const options = {
    includeScore: true,
    includeMatches: true,
    tokenize: true,
    matchAllTokens: true,
    ignoreLocation: true,
    findAllMatches: true,
    distance: 1000,
    useExtendedSearch: ext.opts.general.extendedSearch,
    minMatchCharLength: ext.opts.search.minMatchCharLength,
    threshold: ext.opts.search.threshold,
    keys: [{
      name: 'title',
      weight: ext.opts.search.titleWeight,
    }]
  }

  if (type === 'bookmarks') {
    options.keys.push({
      name: 'tags',
      weight: ext.opts.search.tagWeight,
    }, {
      name: 'url',
      weight: ext.opts.search.urlWeight,
    }, {
      name: 'folder',
      weight: ext.opts.search.folderWeight,
    })
  } else if (type === 'history') {
    options.keys.push({
      name: 'url',
      weight: ext.opts.search.urlWeight,
    })
  } else if (type === 'tabs') {
    options.keys.push({
      name: 'url',
      weight: ext.opts.search.urlWeight,
    })
  } else {
    throw new Error(`Unsupported index type: ${type}`)
  }

  const index = new window.Fuse(searchData, options);

  performance.mark('index-end')
  performance.measure('index-' + type, 'index-start', 'index-end');
  return index
}

//////////////////////////////////////////
// GET AND CONVERT DATA                 //
//////////////////////////////////////////

/**
 * Gets the actual data to search within
 * 
 * Also removes some items (e.g. duplicates) before they are indexed
 */
async function getSearchData() {
  const result = {
    tabs: [],
    bookmarks: [],
    history: [],
  }

  // FIRST: Get data

  if (chrome.tabs) {
    performance.mark('get-data-tabs-start')
    const chromeTabs = await getChromeTabs()
    result.tabs = convertChromeTabs(chromeTabs)
    performance.mark('get-data-tabs-end')
    performance.measure('get-data-tabs', 'get-data-tabs-start', 'get-data-tabs-end');
  }
  if (chrome.bookmarks && ext.opts.bookmarks.enabled) {
    performance.mark('get-data-bookmarks-start')
    const chromeBookmarks = await getChromeBookmarks()
    result.bookmarks = convertChromeBookmarks(chromeBookmarks)
    performance.mark('get-data-bookmarks-end')
    performance.measure('get-data-bookmarks', 'get-data-bookmarks-start', 'get-data-bookmarks-end');
  }
  if (chrome.history && ext.opts.history.enabled) {
    performance.mark('get-data-history-start')
    const chromeHistory = await getChromeHistory(ext.opts.history.daysAgo, ext.opts.history.maxItems)
    result.history = convertChromeHistory(chromeHistory)
    performance.mark('get-data-history-end')
    performance.measure('get-data-history', 'get-data-history-start', 'get-data-history-end');
  }


  // Use mock data (for localhost preview / development)
  // To do this, create a http server (e.g. live-server) in popup/
  if (!chrome.bookmarks || !chrome.history) {
    console.warn(`No Chrome API found. Switching to local dev mode with mock data only`)
    const requestChromeMockData = await fetch('./mockData/chrome.json')
    const chromeMockData = await requestChromeMockData.json()

    result.tabs = convertChromeTabs(chromeMockData.tabs)
    if (ext.opts.bookmarks.enabled) {
      result.bookmarks = convertChromeBookmarks(chromeMockData.bookmarks)
    }
    if (ext.opts.history.enabled) {
      result.history = convertChromeHistory(chromeMockData.history)
    }
  }

  // SECOND: Merge history with bookmarks and tabs and clean up data

  // Build maps with URL as key, so we have fast hashmap access
  const historyMap = result.history.reduce((obj, item, index) => (obj[item.originalUrl] = { ...item, index }, obj) ,{});
  
  // merge history with bookmarks
  result.bookmarks = result.bookmarks.map((el) => {
    if (historyMap[el.originalUrl]) {
      delete result.history[historyMap[el.originalUrl].index]
      return {
        ...historyMap[el.originalUrl],
        ...el,
      }
    } else {
      return el
    }
  })

  // merge history with open tabs
  result.tabs = result.tabs.map((el) => {
    if (historyMap[el.originalUrl]) {
      delete result.history[historyMap[el.originalUrl].index]
      return {
        ...historyMap[el.originalUrl],
        ...el,
      }
    } else {
      return el
    }
  })

  console.debug(`Indexed ${result.tabs.length} tabs, ${result.bookmarks.length} bookmarks and ${result.history.length} history items`)

  return result
}

//////////////////////////////////////////
// SEARCH                               //
//////////////////////////////////////////

/**
 * Uses Fuse.js to do a fuzzy search
 * 
 * @see https://fusejs.io/
 */
function searchWithFuseJs(event) {

  if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'Enter') {
    // Don't execute search on navigation keys
    return
  }

  performance.mark('search-start')

  let searchTerm = ext.searchInput.value ? ext.searchInput.value.trim() : ''
  ext.data.result = []
  let searchMode = 'all' // OR 'bookmarks' OR 'history'

  // Support for history and bookmark only mode
  // This is detected by looking at the first char of the search
  // TODO: This could be optimized by having two separate search indexes?
  if (searchTerm.startsWith('+ ')) {
    searchMode = 'history'
    searchTerm = searchTerm.substring(2)
  } else if (searchTerm.startsWith('- ')) {
    searchMode = 'bookmarks'
    searchTerm = searchTerm.substring(2)
  } else if (searchTerm.startsWith(' .')) {
    searchMode = 'tabs'
    searchTerm = searchTerm.substring(2)
  }

  // If the search term is below minMatchCharLength, no point in starting search
  if (searchTerm.length < ext.opts.search.minMatchCharLength) {
    searchTerm = ''
  }

  // If we have a search term after 
  if (searchTerm) {

    console.debug(`Searching with mode="${searchMode}" for searchTerm="${searchTerm}"`)

    if (searchMode === 'history' && ext.data.historyIndex) {
      ext.data.searchResult = ext.data.historyIndex.search(searchTerm)
    } else if (searchMode === 'bookmarks' && ext.data.bookmarkIndex) {
      ext.data.searchResult = ext.data.bookmarkIndex.search(searchTerm)
    } else if (searchMode === 'tabs' && ext.data.tabIndex) {
      ext.data.searchResult = ext.data.tabIndex.search(searchTerm)
    } else {
      ext.data.searchResult = [
        ...ext.data.tabIndex.search(searchTerm),
        ...ext.data.bookmarkIndex.search(searchTerm),
        ...ext.data.historyIndex.search(searchTerm),
      ]
    }

    // Only render maxResults if given (to improve render performance)
    if (ext.opts.search.maxResults && ext.data.searchResult.length > ext.opts.search.maxResults) {
      ext.data.searchResult = ext.data.searchResult.slice(0, ext.opts.search.maxResults)
    }

    // Convert search results into result format view model
    ext.data.result = ext.data.searchResult.map((el) => {
      const highlighted = ext.opts.general.highlight ? highlightResultItem(el) : {}
      return {
        ...el.item,
        titleHighlighted: highlighted.title || el.item.title,
        tagsHighlighted: highlighted.tags || el.item.tags,
        urlHighlighted: highlighted.url || el.item.url,
        folderHighlighted: highlighted.folder || el.item.folder,
      }
    })
  }

  renderResult(ext.data.result)

  performance.mark('search-end')
  performance.measure('search: ' + searchTerm, 'search-start', 'search-end');
  const searchPerformance = performance.getEntriesByType("measure")
  console.debug('Search Performance: ' + searchPerformance[0].duration, searchPerformance);
  performance.clearMeasures()
}

//////////////////////////////////////////
// UI (RENDERING AND EVENTS)            //
//////////////////////////////////////////

/**
 * Render the search result in UI as result items
 */
function renderResult(result) {

  performance.mark('render-start')

  // Clean current result set
  ext.resultList.innerHTML = '';
  ext.data.currentItem = 0

  for (let i = 0; i < result.length; i++) {
    const resultEntry = result[i]

    // Create result list item (li)
    const resultListItem = document.createElement("li");
    resultListItem.classList.add(resultEntry.type)
    resultListItem.setAttribute('x-open-url', resultEntry.originalUrl)
    resultListItem.setAttribute('x-index', i)
    // Register events for mouse navigation
    resultListItem.addEventListener('mouseup', openResultItem, { passive: true, })
    resultListItem.addEventListener('mouseenter', hoverListItem, { passive: true, })

    // Create title div
    titleDiv = document.createElement('div')
    titleDiv.classList.add('title')
    const titleLink = document.createElement('a');
    titleLink.setAttribute('href', resultEntry.originalUrl);
    titleLink.setAttribute('target', '_newtab');
    if (ext.opts.general.highlight) {
      titleLink.innerHTML = resultEntry.titleHighlighted;
    } else {
      titleLink.innerText = resultEntry.title;
    }
    titleDiv.appendChild(titleLink)
    if (ext.opts.general.tags && resultEntry.tags) {
      const tags = document.createElement('span')
      tags.classList.add('badge', 'tags')
      tags.innerHTML = resultEntry.tagsHighlighted
      titleDiv.appendChild(tags)
    }
    if (resultEntry.folder) {
      const folder = document.createElement('span')
      folder.classList.add('badge', 'folder')
      folder.innerHTML = resultEntry.folderHighlighted
      titleDiv.appendChild(folder)
    }
    if (resultEntry.lastVisit) {
      const lastVisited = document.createElement('span')
      lastVisited.classList.add('badge', 'last-visited')
      lastVisited.innerText = '-' + resultEntry.lastVisit
      titleDiv.appendChild(lastVisited)
    }

    // Create URL div
    urlDiv = document.createElement('div')
    urlDiv.classList.add('url')
    const a = document.createElement('a');
    a.setAttribute('href', resultEntry.originalUrl);
    a.setAttribute('target', '_newtab');
    a.innerHTML = resultEntry.urlHighlighted;
    urlDiv.appendChild(a)

    // Append everything together :)
    resultListItem.appendChild(titleDiv)
    resultListItem.appendChild(urlDiv)
    ext.resultList.appendChild(resultListItem)
  }

  // mark first result item as selected
  selectListItem(0)

  performance.mark('render-end')
  performance.measure('Render DOM', 'render-start', 'render-end');
  const renderPerformance = performance.getEntriesByType("measure")
  console.debug('Render Performance: ' + renderPerformance[0].duration, renderPerformance);
  performance.clearMeasures()
}

/**
 * General key listener that detects keyboard navigation
 * -> Arrow up, Arrow Down, Enter
 */
function navigationKeyListener(event) {
  if (event.key === 'ArrowUp' && ext.data.currentItem > 0) {
    ext.data.currentItem--
    selectListItem(ext.data.currentItem)
  } else if (event.key === 'ArrowDown' && ext.data.currentItem < ext.data.result.length - 1) {
    ext.data.currentItem++
    selectListItem(ext.data.currentItem)
  } else if (event.key === 'Enter' && ext.data.result.length > 0) {
    openResultItem()
  }
}

/**
 * Marks the list item with a specific index as selected
 */
function selectListItem(index) {
  const currentSelection = document.getElementById('selected-result')
  if (currentSelection) {
    currentSelection.id = ''
  }
  if (ext.resultList.children[index]) {
    ext.resultList.children[index].id = 'selected-result'
    ext.resultList.children[index].scrollIntoViewIfNeeded(false)
  }
}

/**
 * When clicked on a list-item, we want to navigate like pressing "Enter"
 */
function openResultItem(event) {
  let url = document.getElementById('selected-result').getAttribute('x-open-url')
  if (event) {
    event.stopPropagation()
  }
  const foundTab = ext.data.searchData.tabs.find((el) => {
    return el.originalUrl === url
  })
  if (foundTab && chrome.tabs.highlight) {
    console.debug('Found tab, setting it active', foundTab)
    chrome.tabs.update(foundTab.originalId, {
      active: true
    })
  } else {
    return window.open(url, '_newtab')
  }
}

function hoverListItem(event) {
  const index = event.target.getAttribute('x-index')
  if (index) {
    document.getElementById('selected-result').id = ''
    event.target.id = 'selected-result'
    ext.data.currentItem = index
  }
}

/**
 * Inspired from https://github.com/brunocechet/Fuse.js-with-highlight/blob/master/index.js 
 */
function highlightResultItem(resultItem) {
  const highlightedResultItem = {}
  for (const matchItem of resultItem.matches) {

    const text = resultItem.item[matchItem.key]
    const result = []
    const matches = [].concat(matchItem.indices);
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
        highlightedResultItem[matchItem.key] = highlightResultItem(child);
      });
    }
  }

  return highlightedResultItem
};

//////////////////////////////////////////
// CHROME SPECIFIC                      //
//////////////////////////////////////////

async function getChromeTabs() {
  return (await chrome.tabs.query({})).filter((el) => {
    return (!el.incognito && el.url && el.url.startsWith('http'))
  })
}

async function getChromeBookmarks() {
  return await chrome.bookmarks.getTree()
}

/**
 * Gets chrome browsing history.
 * Warning: This chrome API call tends to be rather slow
 */
async function getChromeHistory(daysBack, maxResults) {
  return new Promise((resolve, reject) => {
    const startTime = new Date() - 1000 * 60 * 60 * 24 * daysBack;
    chrome.history.search({ text: '', maxResults, startTime }, (history, err) => {
      if (err) {
        return reject(err)
      }
      history = history.filter((el) => {
        return (el.url && el.url.startsWith('http'))
      })
      return resolve(history)
    })
  })
}

function convertChromeTabs(chromeTabs) {
  return chromeTabs.map((entry) => {
    return {
      type: 'tab',
      title: entry.title,
      url: cleanUpUrl(entry.url),
      originalUrl: entry.url,
      originalId: entry.id,
      favIconUrl: entry.favIconUrl,
    }
  })
}

/**
 * Recursive function to return bookmarks in our internal, flat array format
 */
function convertChromeBookmarks(bookmarks, folderTrail, depth) {
  depth = depth || 1
  let result = []
  folderTrail = folderTrail || []

  for (const entry of bookmarks) {

    let newFolderTrail = folderTrail.slice(); // clone
    // Only consider bookmark folders that have a title and have
    // at least a depth of 2, so we skip the default chrome "system" folders
    if (entry.title && depth > 2) {
      newFolderTrail = folderTrail.concat(entry.title)
    }

    // Parse out tags from bookmark title (starting with #) 
    let title = entry.title
    let tags = ''
    if (ext.opts.general.tags && title) {
      const tagSplit = title.split('#')
      title = tagSplit.shift().trim()
      for (const tag of tagSplit) {
        tags += '#' + tag.trim() + ' '
      }
      tags = tags.slice(0, -1)
    }

    let folderText = ''
    for (const folder of folderTrail) {
      folderText += '>' + folder + ' '
    }
    folderText = folderText.slice(0, -1)

    if (entry.url && entry.url.startsWith('http')) {
      result.push({
        type: 'bookmark',
        title: title,
        tags: tags,
        originalUrl: entry.url,
        url: cleanUpUrl(entry.url),
        folder: folderText,
        originalId: entry.id,
      })
    }
    if (entry.children) {
      result = result.concat(convertChromeBookmarks(entry.children, newFolderTrail, depth + 1))
    }
  }

  return result
}

/**
 * Convert chrome history into our internal, flat array format
 */
function convertChromeHistory(history) {
  let result = []

  for (const entry of history) {
    result.push({
      type: 'history',
      title: entry.title,
      originalUrl: entry.url,
      url: cleanUpUrl(entry.url),
      visitCount: entry.visitCount,
      lastVisit: ext.opts.general.lastVisit ? timeSince(new Date(entry.lastVisitTime)) : undefined,
      originalId: entry.id,
    })
  }
  return result
}

//////////////////////////////////////////
// GENERIC HELPERS                      //
//////////////////////////////////////////

/**
 * Get text how long a date is ago
 * 
 * @see https://stackoverflow.com/questions/3177836/how-to-format-time-since-xxx-e-g-4-minutes-ago-similar-to-stack-exchange-site
 */
function timeSince(date) {

  const seconds = Math.floor((new Date() - date) / 1000);

  let interval = seconds / 31536000;

  if (interval > 1) {
    return Math.floor(interval) + " years";
  }
  interval = seconds / 2592000;
  if (interval > 1) {
    return Math.floor(interval) + " months";
  }
  interval = seconds / 86400;
  if (interval > 1) {
    return Math.floor(interval) + " days";
  }
  interval = seconds / 3600;
  if (interval > 1) {
    return Math.floor(interval) + " hours";
  }
  interval = seconds / 60;
  if (interval > 1) {
    return Math.floor(interval) + " minutes";
  }
  return Math.floor(seconds) + " seconds";
}

/**
 * Checks whether DOM element in viewport
 * @see https://gomakethings.com/how-to-test-if-an-element-is-in-the-viewport-with-vanilla-javascript/
 */
function isInViewport(elem) {
  var bounding = elem.getBoundingClientRect();
  return (
    bounding.top >= 0 &&
    bounding.left >= 0 &&
    bounding.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    bounding.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
};

/**
 * Remove http:// or http:// and www from URLs
 * @see https://stackoverflow.com/a/57698415
 */
function cleanUpUrl(url) {
  return url.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "").split('/')[0]
}
