performance.mark('init-start')
const ext = window.ext = {}

//////////////////////////////////////////
// OPTIONS                              //
//////////////////////////////////////////

ext.options = {

  // General options
  general: {
    tags: true,
    highlight: true, // TODO: Skip highlight processing if false
    score: true,
    lastVisit: true,
    removeDuplicateUrls: true, // TODO: This does not find all duplicates yet
    removeNonHttpLinks: true,
    extendedSearch: false,
  },

  // Search options
  search: {
    maxResults: 128,
    minMatchCharLength: 2,
    threshold: 0.4,
    titleWeight: 10,
    tagWeight: 7,
    urlWeight: 5,
    folderWeight: 2,
    lowPrioHistory: true
  },

  // Bookmark options
  bookmarks: {
    enabled: true,
  },

  // History options
  history: {
    enabled: true,
    daysAgo: 5,
    maxItems: 8,
  }
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

  // Use flexsearch
  ext.data.index = initializeFlexSearch(searchData)

  performance.mark('initialized-search')

  // Register Events
  // ext.searchInput.addEventListener("keyup", searchWithFuseJs);
  ext.searchInput.addEventListener("keyup", searchWithFlexSearch);
  document.addEventListener("keydown", navigationKeyListener);

  // Do some performance measurements and log it to debug
  performance.mark('init-complete')
  performance.measure('startToEnd', 'init-start', 'init-complete');
  performance.measure('initializeData', 'initialized-dom', 'initialized-data');
  performance.measure('initializeSearch', 'initialized-data', 'initialized-search');
  console.debug('Init Performance', performance.getEntriesByType("measure"));
  performance.clearMeasures()
}

function initializeFlexSearch(searchData) {
  const index = new FlexSearch.Document({
    tokenize: "strict",
    optimize: true,
    minlength: 2,
    document: {
      id: "id",
      index: [{
        field: "title",
        resolution: 10
      }, {
        field: "tags",
        resolution: 7,
      },
      {
        field: "url",
        resolution: 5,
      }, {
        field: "folder",
        resolution: 2,
      }]
    }
  });

  for (const entry of searchData) {
    index.add(entry)
  }
  return index
}

/**
 * Initialize search with Fuse.js
 */
function initializeFuseJsSearch(searchData) {
  const options = {
    isCaseSensitive: false,
    useExtendedSearch: ext.options.general.extendedSearch,
    includeScore: ext.options.general.score,
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
    // Use mock data (for localhost preview / development)
    if (ext.options.bookmarks.enabled) {
      result = result.concat(convertChromeBookmarks(window.exampleData.bookmarks))
    }
    if (ext.options.history.enabled) {
      result = result.concat(convertChromeHistory(window.exampleData.history))
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

  // Add index to each result item
  for (let i = 0; i < result.length; i++) {
    result[i].id = i
  }

  return result
}

//////////////////////////////////////////
// SEARCH                               //
//////////////////////////////////////////

function searchWithFlexSearch(event) {
  const searchTerm = ext.searchInput.value ? ext.searchInput.value.trim() : ''

  performance.mark('search-start: ' + searchTerm)

  if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'Enter') {
    // Dont execute search on navigation keys
    return
  }

  if (searchTerm === '') {
    ext.data.result = []
  } else {

    let searchResult = ext.data.index.search(searchTerm, {
      limit: ext.options.search.maxResults,
      suggest: true,
      enrich: true,
      // bool: 'and'
    })

    // Move all history results to the bottom
    // if (ext.options.search.lowPrioHistory) {
    //   searchResult = [
    //     ...searchResult.filter(el => el.item.type === 'bookmark'),
    //     ...searchResult.filter(el => el.item.type === 'history'),
    //   ]
    // }

    // const highlighted = highlightSearchMatches(searchResult)

    ext.data.result = []

    for (const entry of searchResult) {

    }
    
    console.log(searchResult)

    // ext.data.result = searchResult.map((el, index) => {
    //   return {
    //     ...el.item,
    //     titleHighlighted: highlighted[index].title,
    //     tagsHighlighted: highlighted[index].tags,
    //     urlHighlighted: highlighted[index].url,
    //     folderHighlighted: highlighted[index].folder,
    //     score: 100 - Math.round(el.score || 0 * 100),
    //   }
    // })
    ext.data.currentItem = 0
  }
  renderResult(ext.data.result)

  performance.mark('search-end: ' + searchTerm)
  performance.measure('search: ' + searchTerm, 'search-start: ' + searchTerm, 'search-end: ' + searchTerm);
  console.debug('Search Performance', performance.getEntriesByType("measure"));
  performance.clearMeasures()
}

/**
 * Uses Fuse.js to do a fuzzy search
 * 
 * @see https://fusejs.io/
 */
function searchWithFuseJs(event) {

  const searchTerm = ext.searchInput.value ? ext.searchInput.value.trim() : ''

  performance.mark('search-start: ' + searchTerm)

  if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'Enter') {
    // Dont execute search on navigation keys
    return
  }

  if (searchTerm === '') {
    ext.data.result = []
  } else {

    let searchResult = ext.fuse.search(searchTerm)

    // Only render maxResults if given (to improve render performance)
    if (ext.options.search.maxResults && searchResult.length > ext.options.search.maxResults) {
      searchResult = searchResult.slice(0, ext.options.search.maxResults)
    }

    // Move all history results to the bottom
    if (ext.options.search.lowPrioHistory) {
      searchResult = [
        ...searchResult.filter(el => el.item.type === 'bookmark'),
        ...searchResult.filter(el => el.item.type === 'history'),
      ]
    }

    const highlighted = highlightSearchMatches(searchResult)

    // TODO: This second mapping could be avoided by merging it with highlightSearchResult()
    ext.data.result = searchResult.map((el, index) => {
      return {
        ...el.item,
        titleHighlighted: highlighted[index].title,
        tagsHighlighted: highlighted[index].tags,
        urlHighlighted: highlighted[index].url,
        folderHighlighted: highlighted[index].folder,
        score: 100 - Math.round(el.score || 0 * 100),
      }
    })
    ext.data.currentItem = 0
  }
  renderResult(ext.data.result)

  performance.mark('search-end: ' + searchTerm)
  performance.measure('search: ' + searchTerm, 'search-start: ' + searchTerm, 'search-end: ' + searchTerm);
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

  // Clean current result set
  ext.resultList.innerHTML = '';

  for (let i = 0; i < result.length; i++) {
    const resultEntry = result[i]

    // Create LI for result list item
    const resultListItem = document.createElement("li");
    resultListItem.classList.add(resultEntry.type)
    if (i === 0) {
      resultListItem.id = 'selected'
    }
    resultListItem.setAttribute('x-url', resultEntry.url)
    resultListItem.addEventListener('click', openListItemLink)

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
    if (ext.options.general.score && resultEntry.score) {
      const score = document.createElement('span')
      score.classList.add('badge', 'score')
      score.innerText = resultEntry.score
      titleDiv.appendChild(score)
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
  if (ext.resultList.children && ext.resultList.children.length > 0) {
    for (const child of ext.resultList.children) {
      child.id = undefined
    }
    ext.resultList.children[index].id = 'selected'
  }
}

/**
 * Support a click on the whole result list item to be a link
 * TODO:  This is a hacky solution. 
 *        It would be better to change the selection on mouse hover
 *        and on click just execute the selected item
 */
function openListItemLink(event) {
  let url = event.target.getAttribute('x-url')
  // Hack, if we accidentally clicked the child div
  // TODO: This could be solved better :)
  if (!url) {
    url = event.target.parentElement.getAttribute('x-url')
  }
  if (url) {
    window.open(url, '_newtab')
  }
}

/**
 * Apply the fuse.js search indexes to highlight found instances of text
 * 
 * TODO: Optimize this?
 * TODO: Try out simpler approach (no fuzzy):
 *       https://bitsofco.de/a-one-line-solution-to-highlighting-search-matches/
 * @see https://gist.github.com/evenfrost/1ba123656ded32fb7a0cd4651efd4db0
 */
function highlightSearchMatches(fuseSearchResult) {
  const set = (obj, path, value) => {
    const pathValue = path.split('.');
    let i;
    for (i = 0; i < pathValue.length - 1; i++) {
      obj = obj[pathValue[i]];
    }
    obj[pathValue[i]] = value;
  };

  const generateHighlightedText = (inputText, regions = []) => {
    let content = '';
    let nextUnhighlightedRegionStartingIndex = 0;

    regions.forEach(region => {
      const lastRegionNextIndex = region[1] + 1;

      content += [
        inputText.substring(nextUnhighlightedRegionStartingIndex, region[0]),
        `<mark>`,
        inputText.substring(region[0], lastRegionNextIndex),
        '</mark>',
      ].join('');

      nextUnhighlightedRegionStartingIndex = lastRegionNextIndex;
    });

    content += inputText.substring(nextUnhighlightedRegionStartingIndex);

    return content;
  };

  return fuseSearchResult
    .filter(({ matches }) => matches && matches.length)
    .map(({ item, matches }) => {
      const highlightedItem = { ...item };

      matches.forEach((match) => {
        set(highlightedItem, match.key, generateHighlightedText(match.value, match.indices));
      });

      return highlightedItem;
    });
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
function convertChromeBookmarks(bookmarks, folderTrail) {
  let result = []
  folderTrail = folderTrail || []

  for (const entry of bookmarks) {

    let newFolderTrail = folderTrail.slice(); // clone
    if (entry.title && entry.title !== 'Bookmarks bar') {
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
      result = result.concat(convertChromeBookmarks(entry.children, newFolderTrail))
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

  var seconds = Math.floor((new Date() - date) / 1000);

  var interval = seconds / 31536000;

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
