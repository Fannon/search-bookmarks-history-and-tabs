performance.mark('init-start')
import { getEffectiveOptions } from './options.js'
import { cleanUpUrl, timeSince } from './utils.js'

const ext = window.ext = {
  /** Extension options */
  opts: {},
  /** Extension data / model */
  data: {},
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
export async function initExtension() {

  // Load effective options, including user customizations
  ext.opts = await getEffectiveOptions()
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

  hashRouter()

  performance.mark('init-search-index')

  // Register Events
  ext.searchInput.addEventListener("keyup", updateSearchUrl);
  document.addEventListener("keydown", navigationKeyListener);
  window.addEventListener("hashchange", hashRouter, false);

  // Start with empty search to display default results
  if (window.location.href === '' || window.location.href === '#') {
    await search()
  }

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
    ignoreLocation: true,
    findAllMatches: true,
    useExtendedSearch: true,
    shouldSort: false,
    minMatchCharLength: ext.opts.search.minMatchCharLength,
    threshold: ext.opts.search.threshold,
    keys: [{
      name: 'title',
      weight: ext.opts.score.titleMultiplicator,
    }]
  }

  if (type === 'bookmarks') {
    options.keys.push({
      name: 'tags',
      weight: ext.opts.score.tagMultiplicator,
    }, {
      name: 'url',
      weight: ext.opts.score.urlMultiplicator,
    }, {
      name: 'folder',
      weight: ext.opts.score.folderMultiplicator,
    })
  } else if (type === 'history') {
    options.keys.push({
      name: 'url',
      weight: ext.opts.score.urlMultiplicator,
    })
  } else if (type === 'tabs') {
    options.keys.push({
      name: 'url',
      weight: ext.opts.score.urlMultiplicator,
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
    const chromeHistory = await getChromeHistory(ext.opts.history.hoursAgo, ext.opts.history.maxItems)
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
  const historyMap = result.history.reduce((obj, item, index) => (obj[item.originalUrl] = { ...item, index }, obj), {});

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


  console.debug(`Indexed ${result.tabs.length} tabs, ${result.bookmarks.length} bookmarks and ${result.history.length} history items.`)

  return result
}

/**
 * Extract tags from bookmark titles
 * 
 * @returns a dictionary where the key is the unique tag name 
 * and the value the number of bookmarks with the tag
 */
function getUniqueTags() {
  const tagsDictionary = {}
  for (const el of ext.data.searchData.bookmarks) {
    if (el.tags) {
      for (let tag of el.tags.split('#')) {
        tag = tag.trim()
        if (tag) {
          if (!tagsDictionary[tag]) {
            tagsDictionary[tag] = 1
          } else {
            tagsDictionary[tag] += 1
          }
        }
      }
    }
  }
  ext.data.tags = tagsDictionary
  return ext.data.tags
}

/**
 * Extract folders from bookmark titles
 * 
 * @returns a dictionary where the key is the unique tag name 
 * and the value the number of bookmarks within the folder
 */
function getUniqueFolders() {
  // Extract tags from bookmark titles
  const foldersDictionary = {}
  for (const el of ext.data.searchData.bookmarks) {
    if (el.folder) {
      for (let folderName of el.folder.split('~')) {
        folderName = folderName.trim()
        if (folderName) {
          if (!foldersDictionary[folderName]) {
            foldersDictionary[folderName] = 1
          } else {
            foldersDictionary[folderName] += 1
          }
        }
      }
    }
  }
  ext.data.folders = foldersDictionary
  return ext.data.folders
}

//////////////////////////////////////////
// SEARCH                               //
//////////////////////////////////////////

function updateSearchUrl() {
  const searchTerm = ext.searchInput.value ? ext.searchInput.value : ''
  window.location.hash = '#search/' + searchTerm
}

async function search(event) {

  if (event) {
    if (
      event.key === 'ArrowUp' ||
      event.key === 'ArrowDown' ||
      event.key === 'Enter' ||
      event.key === 'Escape'
    ) {
      // Don't execute search on navigation keys
      return
    }
  }

  performance.mark('search-start')

  if (!ext.data.tabIndex  && !ext.data.bookmarkIndex && !ext.data.historyIndex) {
    console.warn('No search index found (yet). Skipping search')
    return
  }

  let searchTerm = ext.searchInput.value || ''
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
  } else if (searchTerm.startsWith('. ')) {
    searchMode = 'tabs'
    searchTerm = searchTerm.substring(2)
  }

  // If the search term is below minMatchCharLength, no point in starting search
  if (searchTerm.length < ext.opts.search.minMatchCharLength) {
    searchTerm = ''
  }

  ext.data.searchTerm = searchTerm
  ext.data.searchMode = searchMode

  await searchWithFuseJs(searchTerm, searchMode)
}

/**
 * Uses Fuse.js to do a fuzzy search
 * 
 * @see https://fusejs.io/
 */
async function searchWithFuseJs(searchTerm, searchMode) {

  searchMode = searchMode || 'all'
  searchTerm = searchTerm.toLowerCase()

  performance.mark('search-start')

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
      ext.data.searchResult = []
      if (ext.data.bookmarkIndex) {
        ext.data.searchResult.push(...ext.data.bookmarkIndex.search(searchTerm))
      }
      if (ext.data.tabIndex) {
        ext.data.searchResult.push(...ext.data.tabIndex.search(searchTerm))
      }
      if (ext.data.historyIndex) {
        ext.data.searchResult.push(...ext.data.historyIndex.search(searchTerm))
      }
    }

    // Convert search results into result format view model
    ext.data.result = ext.data.searchResult.map((el) => {
      const highlighted = ext.opts.general.highlight ? highlightResultItem(el) : {}
      return {
        ...el.item,
        fuseScore: el.score,
        titleHighlighted: highlighted.title,
        tagsHighlighted: highlighted.tags,
        urlHighlighted: highlighted.url,
        folderHighlighted: highlighted.folder,
      }
    })
  } else {
    // If we don't have a sufficiently long search term, display current tab related entries
    // Find out if there are any bookmarks or history that match our current open URL

    let currentUrl = window.location.href
    if (chrome && chrome.tabs) {
      const queryOptions = { active: true, currentWindow: true };
      const [tab] = await chrome.tabs.query(queryOptions);
      currentUrl = tab.url
    }
    // Remove trailing slash from URL, so the startsWith search works better
    currentUrl = currentUrl.replace(/\/$/, "")

    const foundBookmarks = ext.data.searchData.bookmarks.filter((el) => el.originalUrl.startsWith(currentUrl))
    ext.data.result = ext.data.result.concat(foundBookmarks)
    const foundHistory = ext.data.searchData.history.filter((el) => {
      return (currentUrl === el.originalUrl || currentUrl === el.originalUrl + '/')
    })
    ext.data.result = ext.data.result.concat(foundHistory)
  }

  sortResult(ext.data.result, searchTerm)

  // Filter out all search results below a certain score
  ext.data.result = ext.data.result.filter((el) => el.score >= ext.opts.score.minScore)

  // Only render maxResults if given (to improve render performance)
  if (ext.data.result.length > ext.opts.search.maxResults) {
    ext.data.result = ext.data.result.slice(0, ext.opts.search.maxResults)
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

  result = result || ext.data.result

  performance.mark('render-start')

  // Clean current result set
  ext.resultList.innerHTML = '';
  ext.data.currentItem = 0

  for (let i = 0; i < result.length; i++) {
    const resultEntry = result[i]

    if (!resultEntry) {
      continue
    }

    // Create result list item (li)
    const resultListItem = document.createElement("li");
    resultListItem.classList.add(resultEntry.type)
    resultListItem.setAttribute('x-index', i)
    resultListItem.setAttribute('x-id', resultEntry.originalId)
    resultListItem.setAttribute('x-open-url', resultEntry.originalUrl)

    // Create edit button
    if (resultEntry.type === 'bookmark') {
      const editButton = document.createElement('a')
      editButton.href = "#edit-bookmark/" + resultEntry.originalId
      editButton.classList.add('edit-button')
      const editImg = document.createElement('img')
      editImg.src = "../images/edit.svg"
      editButton.appendChild(editImg)
      resultListItem.appendChild(editButton)
    }

    // Create title div
    const titleDiv = document.createElement('div')
    titleDiv.classList.add('title')
    const titleLink = document.createElement('a');
    titleLink.setAttribute('href', resultEntry.originalUrl);
    titleLink.setAttribute('target', '_newtab');
    if (ext.opts.general.highlight) {
      titleLink.innerHTML = resultEntry.titleHighlighted || resultEntry.title || resultEntry.urlHighlighted || resultEntry.url;
    } else {
      titleLink.innerText = resultEntry.title;
    }
    titleDiv.appendChild(titleLink)
    if (ext.opts.general.tags && resultEntry.tags) {
      const tags = document.createElement('span')
      tags.classList.add('badge', 'tags')
      tags.innerHTML = resultEntry.tagsHighlighted || resultEntry.tags
      titleDiv.appendChild(tags)
    }
    if (resultEntry.folder) {
      const folder = document.createElement('span')
      folder.classList.add('badge', 'folder')
      folder.innerHTML = resultEntry.folderHighlighted || resultEntry.folder
      titleDiv.appendChild(folder)
    }
    if (ext.opts.general.lastVisit && resultEntry.lastVisit) {
      const lastVisited = document.createElement('span')
      lastVisited.classList.add('badge', 'last-visited')
      lastVisited.innerText = '-' + resultEntry.lastVisit
      titleDiv.appendChild(lastVisited)
    }
    if (ext.opts.general.visitCounter && resultEntry.visitCount) {
      const visitCounter = document.createElement('span')
      visitCounter.classList.add('badge', 'visit-counter')
      visitCounter.innerText = resultEntry.visitCount
      titleDiv.appendChild(visitCounter)
    }
    if (ext.opts.general.displayScore && resultEntry.score) {
      const score = document.createElement('span')
      score.classList.add('badge', 'score')
      score.innerText = Math.round(resultEntry.score)
      titleDiv.appendChild(score)
    }

    // Create URL div
    const urlDiv = document.createElement('div')
    urlDiv.classList.add('url')
    const a = document.createElement('a');
    a.setAttribute('href', resultEntry.originalUrl);
    a.setAttribute('target', '_newtab');
    a.innerHTML = resultEntry.urlHighlighted || resultEntry.url
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
 * Calculates score on basis of the fuse score and some own rules
 * Sorts the result by that score
 */
function sortResult(result, searchTerm) {

  // calculate score
  for (let i = 0; i < result.length; i++) {
    const el = result[i]
    let score = 100

    // Apply result.type weight
    if (el.type === 'bookmark') {
      score = ext.opts.score.bookmarkBaseScore
    } else if (el.type === 'tab') {
      score = ext.opts.score.tabBaseScore
    } else if (el.type === 'history') {
      score = ext.opts.score.historyBaseScore
    }

    // Multiply by fuse.js score. 
    // This will reduce the score if the search is not a good match
    score = score * (1 - el.fuseScore)

    // Increase score if we have exact "startsWith" or alternatively "includes" matches
    if (el.title && el.title.toLowerCase().startsWith(searchTerm)) {
      score += (ext.opts.score.exactStartsWithBonus * ext.opts.score.titleMultiplicator)
    } else if (el.url.startsWith(searchTerm.split(' ').join('-'))) {
      score += (ext.opts.score.exactStartsWithBonus * ext.opts.score.urlMultiplicator)
    } else if (el.title && el.title.toLowerCase().includes(searchTerm)) {
      score += (ext.opts.score.exactIncludesBonus * ext.opts.score.titleMultiplicator)
    } else if (el.url.includes(searchTerm.split(' ').join('-'))) {
      score += (ext.opts.score.exactIncludesBonus * ext.opts.score.urlMultiplicator)
    }

    // Increase score if we have an exact tag match   
    // TODO: This could be made better via a dedicated, non-fuzzy tag-mode search 
    if (el.tags && searchTerm.includes('#')) {
      let searchTermTags = searchTerm.split('#')
      searchTermTags.shift()
      searchTermTags.forEach((tag) => {
        el.tagsArray.map((el) => {
          if (tag === el.toLowerCase()) {
            score += ext.opts.score.exactTagMatchBonus
          }
        })
      })
    }

    // Increase score if we have an exact folder name match    
    // TODO: This could be made better via a dedicated, non-fuzzy folder-mode search 
    if (el.folder && searchTerm.includes('~')) {
      let searchTermFolders = searchTerm.split('~')
      searchTermFolders.shift()
      searchTermFolders.forEach((folderName) => {
        el.folderArray.map((el) => {
          if (folderName === el.toLowerCase()) {
            score += ext.opts.score.exactFolderMatchBonus
          }
        })
      })
    }

    // Increase score if result has been open frequently or recently
    if (el.visitCount) {
      score += Math.min(
        ext.opts.score.visitedBonusScoreMaximum,
        el.visitCount * ext.opts.score.visitedBonusScore
      )
    }

    el.score = score
  }

  result = result.sort((a, b) => {
    return b.score - a.score
  });

  // Helpful for debugging score algorithm
  // console.table(result.map((el) => {
  //   return {
  //     score: el.score,
  //     fuseScore: el.fuseScore,
  //     type: el.type,
  //     title: el.title,
  //     url: el.originalUrl
  //   }
  // }))

  return result
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
    // Enter selects selected search result -> only when in search mode
    if (window.location.hash.startsWith('#search/')) {
      openResultItem()
    }
  } else if (event.key === 'Escape') {
    window.location.hash = '#search/'
    ext.searchInput.focus()
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
// NAVIGATION                           //
//////////////////////////////////////////

function hashRouter() {
  const hash = window.location.hash
  console.debug('Changing Route: ' + hash)
  closeModals()
  if (!hash || hash === '#') {
    // Index route -> redirect to last known search or empty search
    window.location.hash = '#search/' + (ext.data.searchTerm || '')
  } else if (hash.startsWith('#search/')) {
    // Search specific term
    const searchTerm = hash.replace('#search/', '')
    ext.searchInput.value = decodeURIComponent(searchTerm)
    ext.searchInput.focus()
    search()
  } else if (hash.startsWith('#tags/')) {
    getTagsOverview()
  } else if (hash.startsWith('#folders/')) {
    getFoldersOverview()
  } else if (hash.startsWith('#edit-bookmark/')) {
    // Edit bookmark route
    const bookmarkId = hash.replace('#edit-bookmark/', '')
    editBookmark(bookmarkId)
  } else if (hash.startsWith('#update-bookmark/')) {
    // Update bookmark route
    const bookmarkId = hash.replace('#update-bookmark/', '')
    updateBookmark(bookmarkId)
  }
}

function closeModals() {
  document.getElementById('edit-bookmark').style = "display: none;"
  document.getElementById('tags-overview').style = "display: none;"
  document.getElementById('folders-overview').style = "display: none;"
}

//////////////////////////////////////////
// TAGS OVERVIEW                        //
//////////////////////////////////////////

function getTagsOverview() {
  const tags = getUniqueTags()
  document.getElementById('tags-overview').style = ""
  const sortedTags = Object.keys(tags).sort()
  document.getElementById('tags-list').innerHTML = sortedTags.map((el) => {
    return `<a class="badge tags" href="#search/'#${el}">#${el} <small>(${tags[el]})<small></a>`
  }).join('')
}

//////////////////////////////////////////
// FOLDERS OVERVIEW                        //
//////////////////////////////////////////

function getFoldersOverview() {
  const folders = getUniqueFolders()
  document.getElementById('folders-overview').style = ""
  const sortedFolders = Object.keys(folders).sort()
  document.getElementById('folders-list').innerHTML = sortedFolders.map((el) => {
    return `<a class="badge folder" href="#search/'~${el}">~${el} <small>(${folders[el]})<small></a>`
  }).join('')
}

//////////////////////////////////////////
// BOOKMARK EDITING                     //
//////////////////////////////////////////

function editBookmark(bookmarkId) {
  const bookmark = ext.data.searchData.bookmarks.find(el => el.originalId === bookmarkId)
  const tags = Object.keys(getUniqueTags()).sort()
  console.debug('Editing bookmark ' + bookmarkId, bookmark)
  if (bookmark) {
    document.getElementById('edit-bookmark').style = ""
    document.getElementById('bookmark-title').value = bookmark.title
    // document.getElementById('bookmark-tags').value = bookmark.tags
    ext.tagify = new Tagify(document.getElementById('bookmark-tags'), {
      whitelist: tags,
      trim: true,
      transformTag: transformTag,
      skipInvalid: false,
      editTags: {
        clicks: 1,
        keepInvalid: false,
      },
      dropdown: {
        position: "all",
        enabled: 0,
        maxItems: 12,
        closeOnSelect: false,
      }
    })
    const currentTags = bookmark.tags.split('#').map(el => el.trim()).filter(el => el)
    ext.tagify.addTags(currentTags)

    document.getElementById('edit-bookmark-save').href = "#update-bookmark/" + bookmarkId
  } else {
    console.warn(`Tried to edit bookmark id="${bookmarkId}", but coult not find it in searchData.`)
  }

  function transformTag(tagData) {
    if (tagData.value.includes('#')) {
      tagData.value = tagData.value.split('#').join('')
    }
  }
}

function updateBookmark(bookmarkId) {
  const bookmark = ext.data.searchData.bookmarks.find(el => el.originalId === bookmarkId)
  const titleInput = document.getElementById('bookmark-title').value.trim()
  const tagsInput = '#' + ext.tagify.value.map(el => el.value.trim()).join(' #')

  // Update search data model of bookmark
  bookmark.title = titleInput
  bookmark.tags = tagsInput

  console.debug(`Update bookmark with ID ${bookmarkId}: "${titleInput} ${tagsInput}"`)

  if (chrome.bookmarks) {
    chrome.bookmarks.update(bookmarkId, {
      title: `${titleInput} ${tagsInput}`,
    })
  } else {
    console.warn(`No chrome.bookmarks API found. Bookmark update will not persist.`)
  }

  // Start search again to update the search index and the UI with new bookmark model
  window.location.href = '#'
}

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
async function getChromeHistory(hoursAgo, maxResults) {
  return new Promise((resolve, reject) => {
    chrome.history.search({
      text: '',
      maxResults: maxResults,
      startTime: Date.now() - (1000 * 60 * 60 * hoursAgo),
      endTime: Date.now(),
    }, (history, err) => {
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
      originalUrl: entry.url.replace(/\/$/, ''),
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
    let tagsText = ''
    let tagsArray = []
    if (ext.opts.general.tags && title) {
      const tagSplit = title.split('#')
      title = tagSplit.shift().trim()
      tagsArray = tagSplit
      for (const tag of tagSplit) {
        tagsText += '#' + tag.trim() + ' '
      }
      tagsText = tagsText.slice(0, -1)
    }

    let folderText = ''
    for (const folder of folderTrail) {
      folderText += '~' + folder + ' '
    }
    folderText = folderText.slice(0, -1)

    if (entry.url && entry.url.startsWith('http')) {
      result.push({
        type: 'bookmark',
        originalId: entry.id,
        title: title,
        originalUrl: entry.url.replace(/\/$/, ''),
        url: cleanUpUrl(entry.url),
        tags: tagsText,
        tagsArray: tagsArray,
        folder: folderText,
        folderArray: folderTrail,
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
      originalUrl: entry.url.replace(/\/$/, ''),
      url: cleanUpUrl(entry.url),
      visitCount: entry.visitCount,
      lastVisit: ext.opts.general.lastVisit ? timeSince(new Date(entry.lastVisitTime)) : undefined,
      originalId: entry.id,
    })
  }
  return result
}
