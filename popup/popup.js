performance.mark('init-start')

const ext = window.ext = {
  /** Extension functions */
  fn: {},
  /** Extension options */
  options: {},
  /** Extension data / model */
  data: {},
}

//////////////////////////////////////////
// OPTIONS                              //
//////////////////////////////////////////

ext.options.general = {
  /** Extract tags from title and display it as a badge with different search prio */
  tags: true,
  /** Highlight search matches in result */
  highlight: true,
  /** Display  last visit */
  lastVisit: true,
  removeDuplicateUrls: true, // TODO: This does not find all duplicates yet
  removeNonHttpLinks: true,
  /**
   * Enables fuse.js extended search, which additional operators to fine-tune results.
   * @see https://fusejs.io/examples.html#weighted-search
   */
  extendedSearch: true,
}
ext.options.search = {
  maxResults: 128,
  minMatchCharLength: 2,
  /** Fuzzy search threshold (increase to increase fuzzyness) */
  threshold: 0.4,
  titleWeight: 10,
  tagWeight: 7,
  urlWeight: 5,
  folderWeight: 2,
  lowPrioHistory: true
}
ext.options.bookmarks = {
  enabled: true,
}
ext.options.history = {
  enabled: true,
  daysAgo: 5,
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

  console.debug('Initialized with options', ext.options)

  // HTML Element selectors
  ext.popup = document.getElementById('popup');
  ext.searchInput = document.getElementById('search-input')
  ext.resultList = document.getElementById('result-list')
  ext.searchInput.value = ''

  performance.mark('initialized-dom')

  // Model / Data
  ext.data = {
    currentItem: 0,
    result: [],
  }

  const searchData = await getSearchData()

  performance.mark('initialized-data')

  // Inut fuse.js for fuzzy search
  ext.Fuse = Fuse;
  ext.fuse = initializeFuseJsSearch(searchData)

  performance.mark('initialized-search')

  // Register Events
  ext.searchInput.addEventListener("keyup", searchWithFuseJs);
  document.addEventListener("keydown", navigationKeyListener);

  // Do some performance measurements and log it to debug
  performance.mark('init-complete')
  performance.measure('startToEnd', 'init-start', 'init-complete');
  performance.measure('initializeData', 'initialized-dom', 'initialized-data');
  performance.measure('initializeSearch', 'initialized-data', 'initialized-search');
  console.debug('Init Performance', performance.getEntriesByType("measure"));
  performance.clearMeasures()
}

/**
 * Initialize search with Fuse.js
 */
function initializeFuseJsSearch(searchData) {
  const options = {
    isCaseSensitive: false,
    useExtendedSearch: ext.options.general.extendedSearch,
    includeScore: true,
    includeMatches: true,
    maxPatternLength: 32,
    shouldSort: true,
    minMatchCharLength: ext.options.search.minMatchCharLength,
    threshold: ext.options.search.threshold,
    ignoreLocation: true,
    keys: [{
      name: 'title',
      weight: ext.options.search.titleWeight,
    }, {
      name: 'tags',
      weight: ext.options.search.tagWeight,
    }, {
      name: 'url',
      weight: ext.options.search.urlWeight,
    }, {
      name: 'folder',
      weight: ext.options.search.folderWeight,
    }]
  };

  return new window.Fuse(searchData, options);
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
  let result = []
  if (chrome.bookmarks) {
    if (ext.options.bookmarks.enabled) {
      const chromeBookmarks = await getChromeBookmarks()
      result = result.concat(convertChromeBookmarks(chromeBookmarks))
    }
    if (ext.options.history.enabled) {
      const chromeHistory = await getChromeHistory(ext.options.history.daysAgo, ext.options.history.maxItems)
      result = result.concat(convertChromeHistory(chromeHistory))
    }
  } else {
    console.warn(`No Chrome API found. Switching to local dev mode with mock data only`)
    // Use mock data (for localhost preview / development)
    // To do this, create a http server (e.g. live-server) in popup/
    const requestChromeMockData = await fetch('./mockData/chrome.json')
    const chromeMockData = await requestChromeMockData.json()

    if (ext.options.bookmarks.enabled) {
      result = result.concat(convertChromeBookmarks(chromeMockData.bookmarks))
    }
    if (ext.options.history.enabled) {
      result = result.concat(convertChromeHistory(chromeMockData.history))
    }
  }

  // Remove local links
  // Only URLs that begin with http:// or https:// are taken
  if (ext.options.general.removeNonHttpLinks) {
    const ignoredLinks = []
    result = result.filter((el) => {
      if (el.url && el.url.startsWith('http://') || el.url && el.url.startsWith('https://')) {
        return el;
      } else {
        ignoredLinks.push(el)
      }
    })
    if (ignoredLinks.length) {
      console.log(`Ignoring ${ignoredLinks.length} non HTTP URLs`, ignoredLinks)
    }
  }

  // Remove duplicate URLs
  if (ext.options.general.removeDuplicateUrls) {
    const knownUrls = {}
    const duplicatedUrls = []

    result = result.filter((el) => {
      if (!knownUrls[el.url]) {
        knownUrls[el.url] = true
        return el
      } else {
        duplicatedUrls.push(el)
      }
    })

    if (duplicatedUrls.length) {
      console.log(`Ignoring ${duplicatedUrls.length} duplicated URLs`, duplicatedUrls)
    }
  }

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

  let searchTerm = ext.searchInput.value ? ext.searchInput.value.trim() : ''

  performance.mark('search-start')

  if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'Enter') {
    // Don't execute search on navigation keys
    return
  }

  if (searchTerm === '') {
    ext.data.result = []
  } else {

    // Support for history and bookmark only mode
    // This is detected by looking at the first char of the search
    // TODO: This could be optimized by having two separate search indexes?
    let historyOnly = false
    let bookmarksOnly = false
    if (searchTerm.startsWith('+')) {
      historyOnly = true
      searchTerm = searchTerm.substring(1)
    } else if (searchTerm.startsWith('-')) {
      bookmarksOnly = true
      searchTerm = searchTerm.substring(1)
    }

    let searchResult = ext.fuse.search(searchTerm)

    // Only render maxResults if given (to improve render performance)
    if (ext.options.search.maxResults && searchResult.length > ext.options.search.maxResults) {
      searchResult = searchResult.slice(0, ext.options.search.maxResults)
    }

    if (historyOnly) {
      searchResult = searchResult.filter(el => el.item.type === 'history')
    }
    if (bookmarksOnly) {
      searchResult = searchResult.filter(el => el.item.type === 'bookmark')
    }

    // Move all history results to the bottom
    if (!historyOnly && !bookmarksOnly && ext.options.search.lowPrioHistory) {
      searchResult = [
        ...searchResult.filter(el => el.item.type === 'bookmark'),
        ...searchResult.filter(el => el.item.type === 'history'),
      ]
    }

    ext.data.fuseSearchResult = searchResult

    // TODO: This second mapping could be avoided by merging it with highlightSearchResult()
    ext.data.result = searchResult.map((el) => {
      const highlighted = ext.options.general.highlight ? highlightResultItem(el) : {}
      return {
        ...el.item,
        titleHighlighted: highlighted.title || el.item.title,
        tagsHighlighted: highlighted.tags || el.item.tags,
        urlHighlighted: highlighted.url || el.item.url,
        folderHighlighted: highlighted.folder || el.item.folder,
      }
    })
    ext.data.currentItem = 0
  }
  renderResult(ext.data.result)

  performance.mark('search-end')
  performance.measure('search: ' + searchTerm, 'search-start', 'search-end');
  console.debug('Search Performance', performance.getEntriesByType("measure"));
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

  for (let i = 0; i < result.length; i++) {
    const resultEntry = result[i]

    // Create result list item (li)
    const resultListItem = document.createElement("li");
    resultListItem.classList.add(resultEntry.type)
    if (i === 0) {
      resultListItem.id = 'selected'
    }
    resultListItem.setAttribute('x-open-url', resultEntry.url)
    resultListItem.setAttribute('x-index', i)
    // Register events for mouse navigation
    resultListItem.addEventListener('mouseup', openListItemLink, { passive: true, })
    resultListItem.addEventListener('mouseenter', hoverListItem, { passive: true, })

    // Create title div
    titleDiv = document.createElement('div')
    titleDiv.classList.add('title')
    const titleLink = document.createElement('a');
    titleLink.setAttribute('href', resultEntry.url);
    titleLink.setAttribute('target', '_newtab');
    if (ext.options.general.highlight) {
      titleLink.innerHTML = resultEntry.titleHighlighted;
    } else {
      titleLink.innerText = resultEntry.title;
    }
    titleDiv.appendChild(titleLink)
    if (ext.options.general.tags && resultEntry.tags) {
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
    if (ext.options.general.lastVisit && resultEntry.lastVisit) {
      const lastVisited = document.createElement('span')
      lastVisited.classList.add('badge', 'last-visited')
      lastVisited.innerText = '-' + resultEntry.lastVisit
      titleDiv.appendChild(lastVisited)
    }

    // Create URL div
    urlDiv = document.createElement('div')
    urlDiv.classList.add('url')
    const a = document.createElement('a');
    a.setAttribute('href', resultEntry.url);
    a.setAttribute('target', '_newtab');
    a.innerHTML = resultEntry.urlHighlighted;
    urlDiv.appendChild(a)

    // Append everything together :)
    resultListItem.appendChild(titleDiv)
    resultListItem.appendChild(urlDiv)
    ext.resultList.appendChild(resultListItem)
  }

  performance.mark('render-end')
  performance.measure('Render DOM', 'render-start', 'render-end');
  console.debug('Render Performance', performance.getEntriesByType("measure"));
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
    const selection = ext.data.result[ext.data.currentItem]
    console.info('Open Link', selection)
    document.querySelector("#selected a").click();
  }
}

/**
 * Marks the list item with a specific index as selected
 */
function selectListItem(index) {
  document.getElementById('selected').id = ''
  ext.resultList.children[index].id = 'selected'
  ext.resultList.children[index].scrollIntoViewIfNeeded(false)
}

/**
 * When clicked on a list-item, we want to navigate like pressing "Enter"
 */
function openListItemLink(event) {
  let url = document.getElementById('selected').getAttribute('x-open-url')
  event.stopPropagation()
  window.open(url, '_newtab')
}

function hoverListItem(event) {
  const index = event.target.getAttribute('x-index')
  console.log(event)
  if (index) {
    document.getElementById('selected').id = ''
    event.target.id = 'selected'
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

async function getChromeBookmarks() {
  return await chrome.bookmarks.getTree()
}

async function getChromeHistory(daysBack, maxResults) {
  return new Promise((resolve, reject) => {
    const startTime = new Date() - 1000 * 60 * 60 * 24 * daysBack;
    chrome.history.search({ text: '', maxResults, startTime }, (history, err) => {
      if (err) {
        return reject(err)
      }
      return resolve(history)
    })
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
    if (ext.options.general.tags && title) {
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

    if (entry.url) {
      result.push({
        type: 'bookmark',
        title: title,
        tags: tags,
        url: entry.url,
        folder: folderText
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
      url: entry.url,
      visitCount: entry.visitCount,
      lastVisit: timeSince(new Date(entry.lastVisitTime))
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
