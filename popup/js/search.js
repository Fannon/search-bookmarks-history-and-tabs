performance.mark('init-start')
import { browserApi, convertChromeBookmarks, convertChromeHistory, convertChromeTabs, getChromeTabs, getChromeBookmarks, getChromeHistory } from './browserApi.js'
import { createFlexSearchIndex, searchWithFlexSearch } from './flexSearch.js'
import { createFuseJsIndex, searchWithFuseJs } from './fuseSearch.js'
import { getUniqueTags, getUniqueFolders, searchTags, searchFolders } from './taxonomySearch.js'
import { getEffectiveOptions, getUserOptions, setUserOptions } from './options.js'
import { cleanUpUrl, debounce } from './utils.js'

/** Browser extension namespace */
const ext = window.ext = {
  /** Options */
  opts: {},
  /** Model / data */
  model: {
    /** Currently selected result item */
    currentItem: 0,
    /** Current search results */
    result: [],
  },
  /** Commonly used DOM Elements */
  dom: {},
  /** Search indexies */
  index: {
    fuzzy: {},
    precise: {},
    taxonomy: {},
  },
  /** Whether extension is already initialized -> ready for search */
  initialized: false,
}

//////////////////////////////////////////
// INITIALIZE                           //
//////////////////////////////////////////

// Trigger initialization
initExtension().catch((err) => {
  console.error(err)
  document.getElementById('footer-error').innerText = err.message
})

/**
 * Initialize the extension
 * This includes indexing the current bookmarks and history
 */
export async function initExtension() {

  ext.initialized = false
  // Load effective options, including user customizations
  ext.opts = await getEffectiveOptions()
  console.debug('Initialized with options', ext.opts)

  // HTML Element selectors
  ext.dom.searchInput = document.getElementById('search-input')
  ext.dom.resultList = document.getElementById('result-list')
  ext.dom.resultCounter = document.getElementById('result-counter')
  ext.dom.searchApproachToggle = document.getElementById('search-approach-toggle')

  updateSearchApproachToggle()

  performance.mark('init-dom')

  const { bookmarks, tabs, history }  = await getSearchData()
  ext.model.tabs = tabs
  ext.model.bookmarks = bookmarks
  ext.model.history = history

  performance.mark('init-data-load')

  if (ext.opts.search.approach === 'fuzzy') {
    // Initialize fuse.js for fuzzy search
    if (ext.opts.tabs.enabled) {
      ext.index.fuzzy.tabs = createFuseJsIndex('tabs', ext.model.tabs)
    }
    if (ext.opts.bookmarks.enabled) {
      ext.index.fuzzy.bookmarks = createFuseJsIndex('bookmarks', ext.model.bookmarks)
    }
    if (ext.opts.history.enabled) {
      ext.index.fuzzy.history = createFuseJsIndex('history', ext.model.history)
    }
  } else if (ext.opts.search.approach === 'precise') {
    // Initialize fuse.js for fuzzy search
    if (ext.opts.tabs.enabled) {
      ext.index.precise.tabs = createFlexSearchIndex('tabs', ext.model.tabs)
    }
    if (ext.opts.bookmarks.enabled) {
      ext.index.precise.bookmarks = createFlexSearchIndex('bookmarks', ext.model.bookmarks)
    }
    if (ext.opts.history.enabled) {
      ext.index.precise.history = createFlexSearchIndex('history', ext.model.history)
    }
  } else {
    throw new Error(`The option "search.approach" has an unsupported value: ${ext.opts.search.approach}`)
  }

  ext.initialized = true

  performance.mark('init-search-index')

  // Register Events
  document.addEventListener("keydown", navigationKeyListener)
  window.addEventListener("hashchange", hashRouter, false)
  ext.dom.searchInput.addEventListener("keyup", debounce(search, ext.opts.general.debounce))
  ext.dom.searchApproachToggle.addEventListener("mouseup", toggleSearchApproach)

  hashRouter()

  performance.mark('init-router')

  // Do some performance measurements and log it to debug
  performance.mark('init-end')
  performance.measure('init-end-to-end', 'init-start', 'init-end')
  performance.measure('init-dom', 'init-start', 'init-dom')
  performance.measure('init-data-load', 'init-dom', 'init-data-load')
  performance.measure('init-search-index', 'init-data-load', 'init-search-index')
  performance.measure('init-router', 'init-search-index', 'init-router')
  const initPerformance = performance.getEntriesByType("measure")
  const totalInitPerformance = performance.getEntriesByName("init-end-to-end")
  console.debug('Init Performance: ' + totalInitPerformance[0].duration + 'ms', initPerformance)
  performance.clearMeasures()
}


//////////////////////////////////////////
// NAVIGATION                           //
//////////////////////////////////////////

function hashRouter() {
  const hash = window.location.hash
  console.debug('Changing Route: ' + hash)
  closeModals()
  if (!hash || hash === '#') {
    // Index route -> redirect to last known search or empty search
    window.location.hash = '#search/'
  } else if (hash.startsWith('#search/')) {
    // Search specific term
    const searchTerm = hash.replace('#search/', '')
    if (searchTerm) {
      ext.dom.searchInput.value = decodeURIComponent(searchTerm)
    }
    ext.dom.searchInput.focus()
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

  // reset error messages
  document.getElementById('footer-error').innerText = ''
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

  if (browserApi.tabs) {
    performance.mark('get-data-tabs-start')
    const chromeTabs = await getChromeTabs()
    result.tabs = convertChromeTabs(chromeTabs)
    performance.mark('get-data-tabs-end')
    performance.measure('get-data-tabs', 'get-data-tabs-start', 'get-data-tabs-end')
  }
  if (browserApi.bookmarks && ext.opts.bookmarks.enabled) {
    performance.mark('get-data-bookmarks-start')
    const chromeBookmarks = await getChromeBookmarks()
    result.bookmarks = convertChromeBookmarks(chromeBookmarks)
    performance.mark('get-data-bookmarks-end')
    performance.measure('get-data-bookmarks', 'get-data-bookmarks-start', 'get-data-bookmarks-end')
  }
  if (browserApi.history && ext.opts.history.enabled) {
    performance.mark('get-data-history-start')
    const chromeHistory = await getChromeHistory(ext.opts.history.daysAgo, ext.opts.history.maxItems)
    result.history = convertChromeHistory(chromeHistory)
    performance.mark('get-data-history-end')
    performance.measure('get-data-history', 'get-data-history-start', 'get-data-history-end')
  }

  // Use mock data (for localhost preview / development)
  // To do this, create a http server (e.g. live-server) in popup/
  if (!browserApi.bookmarks || !browserApi.history) {
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
  const historyMap = result.history.reduce((obj, item, index) => (obj[item.originalUrl] = { ...item, index }, obj), {})

  // merge history with bookmarks
  result.bookmarks = result.bookmarks.map((el, index) => {
    if (historyMap[el.originalUrl]) {
      delete result.history[historyMap[el.originalUrl].index]
      return {
        index: index,
        ...historyMap[el.originalUrl],
        ...el,
      }
    } else {
      return el
    }
  })

  // merge history with open tabs
  result.tabs = result.tabs.map((el, index) => {
    if (historyMap[el.originalUrl]) {
      delete result.history[historyMap[el.originalUrl].index]
      return {
        index: index,
        ...historyMap[el.originalUrl],
        ...el,
      }
    } else {
      return el
    }
  })

  // Clean up array and remove all deleted items from it
  result.history = result.history.filter(el => el)

  // Add index to all search results
  for (let i = 0; i < result.tabs.length; i++) {
    result.tabs[i].index = i;
  }
  for (let i = 0; i < result.bookmarks.length; i++) {
    result.bookmarks[i].index = i;
  }
  for (let i = 0; i < result.history.length; i++) {
    result.history[i].index = i;
  }

  console.debug(`Indexed ${result.tabs.length} tabs, ${result.bookmarks.length} bookmarks and ${result.history.length} history items.`)

  return result
}

//////////////////////////////////////////
// SEARCH                               //
//////////////////////////////////////////

async function search(event) {

  if (event) {
    // Don't execute search on navigation keys
    if (
      event.key === 'ArrowUp' ||
      event.key === 'ArrowDown' ||
      event.key === 'Enter' ||
      event.key === 'Escape'
    ) {
      return
    }
  }

  if (!ext.initialized) {
    console.warn('Extension not initialized (yet). Skipping search')
    return
  }

  performance.mark('search-start')

  let searchTerm = ext.dom.searchInput.value || ''
  ext.model.result = []
  let searchMode = 'all' // OR 'bookmarks' OR 'history'

  // Support for various search modes
  // This is detected by looking at the first chars of the search
  if (searchTerm.startsWith('h ')) {
    // Only history
    searchMode = 'history'
    searchTerm = searchTerm.substring(2)
  } else if (searchTerm.startsWith('b ')) {
    // Only bookmarks
    searchMode = 'bookmarks'
    searchTerm = searchTerm.substring(2)
  } else if (searchTerm.startsWith('t ')) {
    // Only Tabs
    searchMode = 'tabs'
    searchTerm = searchTerm.substring(2)
  } else if (searchTerm.startsWith('s ')) {
    // Only search engines
    searchMode = 'search'
    searchTerm = searchTerm.substring(2)
  } else if (searchTerm.startsWith('#')) {
    // Tag search
    searchMode = 'tags'
    searchTerm = searchTerm.substring(1)
  } else if (searchTerm.startsWith('~')) {
    // Tag search
    searchMode = 'folders'
    searchTerm = searchTerm.substring(1)
  }

  ext.model.searchTerm = searchTerm
  ext.model.searchMode = searchMode

  if (searchTerm) {
    if (searchMode === 'tags') {
      ext.model.result.push(...searchTags(searchTerm))
    } else if (searchMode === 'folders') {
      ext.model.result.push(...searchFolders(searchTerm))
    } else if (ext.opts.search.approach === 'fuzzy') {
      const results = await searchWithFuseJs(searchTerm, searchMode)
      ext.model.result.push(...results)
    } else if (ext.opts.search.approach === 'precise') {
      const results = searchWithFlexSearch(searchTerm, searchMode)
      ext.model.result.push(...results)
    } else {
      throw new Error(`Unsupported option "search.approach" value: "${ext.opts.search.approach}"`)
    }
    // Add search engine result items
    if (searchMode === 'all' || searchMode === 'search') {
      ext.model.result.push(...addSearchEngines(searchTerm))
    }
  } else {
    const defaultEntries = await searchDefaultEntries()
    ext.model.result.push(...defaultEntries)
  }

  ext.model.result = calculateFinalScore(ext.model.result, searchTerm, true)

  // Filter out all search results below a certain score
  ext.model.result = ext.model.result.filter((el) => el.score >= ext.opts.score.minScore)

  // Only render maxResults if given (to improve render performance)
  // Not applied on tag and folder search
  if (searchMode !== 'tags' && searchMode !== 'folders' && ext.model.result.length > ext.opts.search.maxResults) {
    ext.model.result = ext.model.result.slice(0, ext.opts.search.maxResults)
  }

  ext.dom.resultCounter.innerText = `(${ext.model.result.length})`

  renderResult(ext.model.result)
}

/**
 * If we don't have a search term yet (or not sufficiently long), display current tab related entries.
 * 
 * Finds out if there are any bookmarks or history that match our current open URL.
 */
async function searchDefaultEntries() {
  console.debug(`Searching for default results`)

  let results = []

  let currentUrl = window.location.href
  if (browserApi.tabs) {
    const queryOptions = { active: true, currentWindow: true }
    const [tab] = await browserApi.tabs.query(queryOptions)
    currentUrl = tab.url
  }
  // Remove trailing slash from URL, so the startsWith search works better
  currentUrl = currentUrl.replace(/\/$/, "")

  // Find if current URL has corresponding bookmark(s)
  const foundBookmarks = ext.model.bookmarks.filter(el => el.originalUrl.startsWith(currentUrl))
  results.push(...foundBookmarks)

  // Find if we have browser history that has the same URL
  let foundHistory = ext.model.history.filter(el => currentUrl === el.originalUrl)
  results.push(...foundHistory)

  results = results.map((el) => {
    return {
      searchScore: 1,
      ...el,
    }
  })

  return results
}

/**
 * Add results that use the configured search engines with the current search term
 */
function addSearchEngines(searchTerm) {
  const results = []
  if (ext.opts.searchEngines.enabled) {
    for (const searchEngine of ext.opts.searchEngines.choices) {
      const url = searchEngine.urlPrefix + encodeURIComponent(searchTerm)
      results.push({
        type: "search",
        title: `${searchEngine.name}: "${searchTerm}"`,
        url: cleanUpUrl(url),
        originalUrl: url,
        searchScore: ext.opts.score.titleWeight,
      })
    }
  }
  return results
}

//////////////////////////////////////////
// UI (RENDERING AND EVENTS)            //
//////////////////////////////////////////

/**
 * Render the search result in UI as result items
 */
function renderResult(result) {

  result = result || ext.model.result

  performance.mark('render-start')

  const resultListItems = []
  
  for (let i = 0; i < result.length; i++) {
    const resultEntry = result[i]

    if (!resultEntry) {
      continue
    }

    // Create result list item (li)
    const resultListItem = document.createElement("li")
    resultListItem.classList.add(resultEntry.type)
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
    const titleLink = document.createElement('a')
    titleLink.setAttribute('href', resultEntry.originalUrl)
    titleLink.setAttribute('target', '_newtab')
    if (ext.opts.general.highlight) {
      const content = resultEntry.titleHighlighted || resultEntry.title || resultEntry.urlHighlighted || resultEntry.url
      if (content.includes('<mark>')) {
        titleLink.innerHTML = content
      } else {
        titleLink.innerText = content
      }
    } else {
      titleLink.innerText = resultEntry.title | resultEntry.url
    }
    titleDiv.appendChild(titleLink)
    if (ext.opts.general.tags && resultEntry.tags) {
      const tags = document.createElement('span')
      tags.classList.add('badge', 'tags')
      if (ext.opts.general.highlight && resultEntry.tagsHighlighted && resultEntry.tagsHighlighted.includes('<mark>')) {
        tags.innerHTML = resultEntry.tagsHighlighted
      } else {
        tags.innerText = resultEntry.tags
      }
      titleDiv.appendChild(tags)
    }
    if (resultEntry.folder) {
      const folder = document.createElement('span')
      folder.classList.add('badge', 'folder')
      if (ext.opts.general.highlight && resultEntry.folderHighlighted && resultEntry.folderHighlighted.includes('<mark>')) {
        folder.innerHTML = resultEntry.folderHighlighted
      } else {
        folder.innerText = resultEntry.folder
      }
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
    if (ext.opts.general.score && resultEntry.score) {
      const score = document.createElement('span')
      score.classList.add('badge', 'score')
      score.innerText = Math.round(resultEntry.score)
      titleDiv.appendChild(score)
    }

    // Create URL div
    const urlDiv = document.createElement('div')
    urlDiv.classList.add('url')
    const a = document.createElement('a')
    a.setAttribute('href', resultEntry.originalUrl)
    a.setAttribute('target', '_newtab')
    if (ext.opts.general.highlight && resultEntry.urlHighlighted && resultEntry.urlHighlighted.includes('<mark>')) {
      urlDiv.innerHTML = resultEntry.urlHighlighted
    } else {
      urlDiv.innerText = resultEntry.url
    }
    urlDiv.appendChild(a)

    // Append everything together :)
    resultListItem.appendChild(titleDiv)
    resultListItem.appendChild(urlDiv)
    resultListItems.push(resultListItem)
  }

  if (ext.opts.general.highlight) {
    // Use mark.js to highlight search results, if we don't have already done so via fuse.js
    // This applies to flexsearch and taxonomy search results
    if (ext.opts.search.approach === 'precise' || ext.model.searchMode === 'tags' || ext.model.searchMode === 'folders') {
      const markInstance = new Mark(resultListItems)
      markInstance.mark(ext.dom.searchInput.value)
    }
  }

  // Replace current results with new results
  ext.dom.resultList.replaceChildren(...resultListItems);

  // mark first result item as selected
  selectListItem(0)

  performance.mark('render-end')
  performance.measure('Render DOM', 'render-start', 'render-end')
  const renderPerformance = performance.getEntriesByType("measure")
  console.debug('Render Performance: ' + renderPerformance[0].duration + 'ms', renderPerformance)
  performance.clearMeasures()
}

/**
 * Calculates the final search item score on basis of the search score and some own rules
 * Optionally sorts the result by that score
 */
export function calculateFinalScore(result, searchTerm, sort) {

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
    } else if (el.type === 'search') {
      score = ext.opts.score.searchEngineBaseScore
    } else {
      throw new Error(`Search result type "${el.type}" not supported`)
    }

    // Multiply by fuse.js score. 
    // This will reduce the score if the search is not a good match
    score = score * el.searchScore

    // Increase score if we have exact "startsWith" or alternatively "includes" matches
    if (el.title && el.title.toLowerCase().startsWith(searchTerm)) {
      score += (ext.opts.score.exactStartsWithBonus * ext.opts.score.titleWeight)
    } else if (el.url.startsWith(searchTerm.split(' ').join('-'))) {
      score += (ext.opts.score.exactStartsWithBonus * ext.opts.score.urlWeight)
    } else if (el.title && el.title.toLowerCase().includes(searchTerm)) {
      score += (ext.opts.score.exactIncludesBonus * ext.opts.score.titleWeight)
    } else if (el.url.includes(searchTerm.split(' ').join('-'))) {
      score += (ext.opts.score.exactIncludesBonus * ext.opts.score.urlWeight)
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

  if (sort) {
    result = result.sort((a, b) => {
      return b.score - a.score
    })
  }

  // Helpful for debugging score algorithm
  // console.table(result.map((el) => {
  //   return {
  //     score: el.score,
  //     searchScore: el.searchScore,
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
  if (event.key === 'ArrowUp' && ext.model.currentItem > 0) {
    ext.model.currentItem--
    selectListItem(ext.model.currentItem)
  } else if (event.key === 'ArrowDown' && ext.model.currentItem < ext.model.result.length - 1) {
    ext.model.currentItem++
    selectListItem(ext.model.currentItem)
  } else if (event.key === 'Enter' && ext.model.result.length > 0) {
    // Enter selects selected search result -> only when in search mode
    if (window.location.hash.startsWith('#search/')) {
      openResultItem()
    }
  } else if (event.key === 'Escape') {
    window.location.hash = '#search/'
    ext.dom.searchInput.focus()
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
  if (ext.dom.resultList.children[index]) {
    ext.dom.resultList.children[index].id = 'selected-result'
    if (ext.dom.resultList.children[index].scrollIntoViewIfNeeded) {
      ext.dom.resultList.children[index].scrollIntoViewIfNeeded(false)
    } else {
      ext.dom.resultList.children[index].scrollIntoView({
        behavior: "smooth", block: "end", inline: "nearest"
      });
    }
  }
  ext.model.currentItem = index
}

/**
 * When clicked on a list-item, we want to navigate like pressing "Enter"
 */
function openResultItem(event) {
  let url = document.getElementById('selected-result').getAttribute('x-open-url')
  if (event) {
    event.stopPropagation()
  }
  const foundTab = ext.model.tabs.find((el) => {
    return el.originalUrl === url
  })
  if (foundTab && browserApi.tabs.highlight) {
    console.debug('Found tab, setting it active', foundTab)
    browserApi.tabs.update(foundTab.originalId, {
      active: true
    })
    window.close()
  } else {
    return window.open(url, '_newtab')
  }
}

async function toggleSearchApproach() {
  const userOptions = await getUserOptions()
  console.log(userOptions)

  if (ext.opts.search.approach === 'fuzzy') {
    ext.opts.search.approach = 'precise'
  } else {
    ext.opts.search.approach = 'fuzzy'
  }

  if (userOptions.search) {
    userOptions.search.approach = ext.opts.search.approach
  } else {
    userOptions.search = { approach: ext.opts.search.approach }
  }

  // Update user options
  await setUserOptions(userOptions)
  // Init extension again
  await initExtension()
}

function updateSearchApproachToggle() {
  if (ext.opts.search.approach === 'fuzzy') {
    ext.dom.searchApproachToggle.innerText = 'FUZZY'
    ext.dom.searchApproachToggle.classList = 'fuzzy'
  } else if (ext.opts.search.approach === 'precise') {
    ext.dom.searchApproachToggle.innerText = 'PRECISE'
    ext.dom.searchApproachToggle.classList = 'precise'
  }
}


//////////////////////////////////////////
// TAGS OVERVIEW                        //
//////////////////////////////////////////

function getTagsOverview() {
  const tags = getUniqueTags()
  document.getElementById('tags-overview').style = ""
  const sortedTags = Object.keys(tags).sort()
  document.getElementById('tags-list').innerHTML = sortedTags.map((el) => {
    return `<a class="badge tags" href="#search/#${el}">#${el} <small>(${tags[el].length})<small></a>`
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
    return `<a class="badge folder" href="#search/~${el}">~${el} <small>(${folders[el].length})<small></a>`
  }).join('')
}

//////////////////////////////////////////
// BOOKMARK EDITING                     //
//////////////////////////////////////////

function editBookmark(bookmarkId) {
  const bookmark = ext.model.bookmarks.find(el => el.originalId === bookmarkId)
  const tags = Object.keys(getUniqueTags()).sort()
  console.debug('Editing bookmark ' + bookmarkId, bookmark)
  if (bookmark) {
    document.getElementById('edit-bookmark').style = ""
    document.getElementById('bookmark-title').value = bookmark.title
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
  const bookmark = ext.model.bookmarks.find(el => el.originalId === bookmarkId)
  const titleInput = document.getElementById('bookmark-title').value.trim()
  const tagsInput = '#' + ext.tagify.value.map(el => el.value.trim()).join(' #')

  // Update search data model of bookmark
  bookmark.title = titleInput
  bookmark.tags = tagsInput

  console.debug(`Update bookmark with ID ${bookmarkId}: "${titleInput} ${tagsInput}"`)

  if (browserApi.bookmarks) {
    browserApi.bookmarks.update(bookmarkId, {
      title: `${titleInput} ${tagsInput}`,
    })
  } else {
    console.warn(`No browser bookmarks API found. Bookmark update will not persist.`)
  }

  // Start search again to update the search index and the UI with new bookmark model
  window.location.href = '#'
}
