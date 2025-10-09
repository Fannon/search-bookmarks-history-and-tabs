//////////////////////////////////////////
// SEARCH VIEW                          //
//////////////////////////////////////////

import { timeSince } from '../helper/utils.js'
import { getUserOptions, setUserOptions } from '../model/options.js'
import { search } from '../search/common.js'

/**
 * Render the search results in UI as result items with performance optimizations
 */
export async function renderSearchResults(result) {
  result = result || ext.model.result

  if (!result || result.length === 0) {
    ext.dom.resultList.replaceChildren()
    selectListItem(-1)
    return
  }

  ext.model.mouseHoverEnabled = false

  // Limit rendering to improve performance for large result sets
  const maxRender = Math.min(result.length, ext.opts.searchMaxResults || 100)
  const resultsToRender = result.slice(0, maxRender)

  // Batch DOM operations using DocumentFragment for better performance
  const fragment = document.createDocumentFragment()
  const resultListItems = []

  for (let i = 0; i < resultsToRender.length; i++) {
    const resultEntry = resultsToRender[i]

    if (!resultEntry) continue

    // Reuse existing DOM elements when possible (virtual scrolling concept)
    let resultListItem = ext.dom.resultList.children[i]

    if (!resultListItem) {
      // Create new element only if needed
      resultListItem = document.createElement('li')
      fragment.appendChild(resultListItem)
    } else {
      // Clear existing content for reuse
      resultListItem.innerHTML = ''
    }

    // Batch attribute setting
    resultListItem.className = resultEntry.type
    resultListItem.setAttribute('x-open-url', resultEntry.originalUrl)
    resultListItem.setAttribute('x-index', i)
    resultListItem.setAttribute('x-original-id', resultEntry.originalId)
    resultListItem.style.cssText = `border-left: ${ext.opts.colorStripeWidth}px solid ${
      ext.opts[resultEntry.type + 'Color']
    }`

    // Create edit button / image (only for bookmarks)
    if (resultEntry.type === 'bookmark') {
      const editImg = document.createElement('img')
      editImg.className = 'edit-button'
      editImg.setAttribute('x-link', '#edit-bookmark/' + resultEntry.originalId)
      editImg.title = 'Edit Bookmark'
      editImg.src = '../images/edit.svg'
      resultListItem.appendChild(editImg)
    }

    // Create close button for tabs
    if (resultEntry.type === 'tab') {
      const closeImg = document.createElement('img')
      closeImg.className = 'close-button'
      closeImg.title = 'Close Tab'
      closeImg.src = '../images/x.svg'
      resultListItem.appendChild(closeImg)
    }

    // Create title div with optimized content creation
    const titleDiv = document.createElement('div')
    titleDiv.className = 'title'

    // Create title text with optimized content handling
    const titleText = document.createElement('span')
    titleText.className = 'title-text'

    if (ext.opts.displaySearchMatchHighlight) {
      const content = resultEntry.titleHighlighted || resultEntry.title || resultEntry.urlHighlighted || resultEntry.url
      titleText.innerHTML = content.includes('<mark>') ? content + ' ' : content + ' '
    } else {
      titleText.textContent = (resultEntry.title || resultEntry.url) + ' '
    }
    titleDiv.appendChild(titleText)

    // Batch badge creation for better performance
    const badges = []

    if (ext.opts.displayTags && resultEntry.tagsArray) {
      for (const tag of resultEntry.tagsArray) {
        const el = document.createElement('span')
        el.title = 'Bookmark Tags'
        el.className = 'badge tags'
        el.setAttribute('x-link', `#search/#${tag}`)
        el.textContent = '#' + tag
        badges.push(el)
      }
    }

    if (ext.opts.displayFolderName && resultEntry.folderArray) {
      const trail = []
      for (const f of resultEntry.folderArray) {
        trail.push(f)
        const el = document.createElement('span')
        el.title = 'Bookmark Folder'
        el.className = 'badge folder'
        el.setAttribute('x-link', `#search/~${trail.join(' ~')}`)
        if (ext.opts.bookmarkColor) {
          el.style.backgroundColor = ext.opts.bookmarkColor
        }
        el.textContent = '~' + f
        badges.push(el)
      }
    }

    if (ext.opts.displayLastVisit && resultEntry.lastVisitSecondsAgo) {
      const lastVisit = timeSince(new Date(Date.now() - resultEntry.lastVisitSecondsAgo * 1000))
      const lastVisited = document.createElement('span')
      lastVisited.title = 'Last Visited'
      lastVisited.className = 'badge last-visited'
      lastVisited.textContent = '-' + lastVisit
      badges.push(lastVisited)
    }

    if (ext.opts.displayVisitCounter && resultEntry.visitCount !== undefined) {
      const visitCounter = document.createElement('span')
      visitCounter.title = 'Visited Counter'
      visitCounter.className = 'badge visit-counter'
      visitCounter.textContent = resultEntry.visitCount
      badges.push(visitCounter)
    }

    if (ext.opts.displayDateAdded && resultEntry.dateAdded) {
      const dateAdded = document.createElement('span')
      dateAdded.title = 'Date Added'
      dateAdded.className = 'badge date-added'
      dateAdded.textContent = new Date(resultEntry.dateAdded).toISOString().split('T')[0]
      badges.push(dateAdded)
    }

    if (ext.opts.displayScore && resultEntry.score) {
      const score = document.createElement('span')
      score.title = 'Score'
      score.className = 'badge score'
      score.textContent = Math.round(resultEntry.score)
      badges.push(score)
    }

    // Append all badges at once
    titleDiv.append(...badges)

    // Create URL div with optimized content
    const urlDiv = document.createElement('div')
    urlDiv.className = 'url'
    urlDiv.title = resultEntry.url
    if (
      ext.opts.displaySearchMatchHighlight &&
      resultEntry.urlHighlighted &&
      resultEntry.urlHighlighted.includes('<mark>')
    ) {
      urlDiv.innerHTML = resultEntry.urlHighlighted
    } else {
      urlDiv.textContent = resultEntry.url
    }

    resultListItem.append(titleDiv, urlDiv)

    // Add event listeners only once for new elements
    if (!resultListItem.hasAttribute('data-events-attached')) {
      resultListItem.addEventListener('mouseenter', hoverResultItem)
      resultListItem.addEventListener('mouseup', openResultItem)
      resultListItem.setAttribute('data-events-attached', 'true')
    }

    resultListItems.push(resultListItem)
  }

  // Batch update the DOM
  requestAnimationFrame(() => {
    ext.dom.resultList.replaceChildren(fragment)
    selectListItem(0)
  })

  // Post-render highlighting with throttling
  if (ext.opts.displaySearchMatchHighlight && ext.model.searchTerm && window.Mark) {
    requestAnimationFrame(() => {
      resultsToRender.forEach((resultEntry, index) => {
        if (!resultEntry.titleHighlighted || !resultEntry.urlHighlighted) {
          const element = ext.dom.resultList.children[index]
          if (element) {
            const mark = new window.Mark(element)
            mark.mark(ext.model.searchTerm)
          }
        }
      })
    })
  }
}

//////////////////////////////////////////
// SEARCH VIEW NAVIGATION               //
//////////////////////////////////////////

/**
 * General key listener that detects keyboard navigation
 * -> Arrow up, Arrow Down, Enter
 */
export function navigationKeyListener(event) {
  // Navigation via arrows or via Vim style
  const up = event.key === 'ArrowUp' || (event.ctrlKey && event.key === 'p') || (event.ctrlKey && event.key === 'k')
  const down = event.key === 'ArrowDown' || (event.ctrlKey && event.key === 'n') || (event.ctrlKey && event.key === 'j')

  if (up && ext.dom.searchInput.value && ext.model.currentItem === 0) {
    event.preventDefault()
  } else if (up && ext.model.currentItem > 0) {
    event.preventDefault()
    selectListItem(ext.model.currentItem - 1, true)
  } else if (down && ext.model.currentItem < ext.model.result.length - 1) {
    event.preventDefault()
    selectListItem(ext.model.currentItem + 1, true)
  } else if (event.key === 'Enter' && ext.model.result.length > 0) {
    // Enter selects selected search result -> only when in search mode
    if (window.location.hash.startsWith('#search/') || !window.location.hash) {
      openResultItem(event)
    }
  } else if (event.key === 'Escape') {
    window.location.hash = '#search/'
    ext.dom.searchInput.focus()
  }
}

/**
 * Marks the list item with a specific index as selected
 */
export function selectListItem(index, scroll = false) {
  const currentSelection = document.getElementById('selected-result')
  if (currentSelection) {
    currentSelection.id = ''
    delete currentSelection.id
  }
  if (ext.dom.resultList.children[index]) {
    ext.dom.resultList.children[index].id = 'selected-result'

    if (scroll) {
      ext.dom.resultList.children[index].scrollIntoView({
        behavior: 'auto',
        block: 'nearest',
      })
    }
  }
  ext.model.currentItem = index
}

/**
 * When clicked on a list-item, we want to navigate like pressing "Enter"
 */
export function hoverResultItem(event) {
  const target = event.target ? event.target : event.srcElement
  const index = target.getAttribute('x-index')

  // Workaround to avoid that we get a mouse hover event
  // just by rendering the results "below" the pointer
  if (!ext.model.mouseHoverEnabled) {
    ext.model.mouseHoverEnabled = true
    return
  }

  if (index) {
    selectListItem(index)
  } else {
    console.warn('Could not hover result item', target, event)
  }
}

/**
 * When clicked on a list-item, we want to navigate like pressing "Enter"
 */
export function openResultItem(event) {
  const resultEntry = document.getElementById('selected-result')
  const originalId = resultEntry.getAttribute('x-original-id')
  const url = resultEntry.getAttribute('x-open-url')

  if (event) {
    event.stopPropagation()
    let target = event.target ? event.target : event.srcElement
    if (target.nodeName === 'MARK') {
      target = target.parentNode
    }

    // If the event is a click event on an navigation element (x-link), follow that link
    if (target && target.getAttribute('x-link')) {
      window.location = target.getAttribute('x-link')
      return
    } else if (target && target.className.includes('close-button')) {
      const targetId = parseInt(originalId)
      ext.browserApi.tabs.remove(targetId) // Close Browser Tab
      document.querySelector(`#result-list > li[x-original-id="${originalId}"]`).remove(targetId)
      ext.model.tabs.splice(
        ext.model.tabs.findIndex((el) => el.originalId === targetId),
        1,
      )
      ext.model.result.splice(
        ext.model.result.findIndex((el) => el.originalId === targetId),
        1,
      )
      renderSearchResults()
      return
    }
  }

  // Right click mouse -> copy URL of result to clipboard
  if (event.button === 2) {
    navigator.clipboard.writeText(url)
    event.preventDefault()
    return
  }

  // If we press SHIFT or ALT while selecting an entry: Open it in current tab
  if (event.shiftKey || event.altKey) {
    if (ext.browserApi.tabs) {
      ext.browserApi.tabs
        .query({
          active: true,
          currentWindow: true,
        })
        .then(([currentTab]) => {
          ext.browserApi.tabs.update(currentTab.id, {
            url: url,
          })

          // Only close popup if CTRL is not pressed
          if (!event.ctrlKey) {
            window.close()
          }
        })
        .catch(console.error)
    } else {
      window.location.href = url
    }
    return
  }

  // If we press CTRL while selecting an entry: Open it in new tab in the background (don't close popup)
  if (event.ctrlKey) {
    if (ext.browserApi.tabs) {
      ext.browserApi.tabs.create({
        active: false,
        url: url,
      })
    } else {
      window.open(url, '_newtab')
    }
    return
  }

  // If we use no modifier when selecting an entry: Navigate to selected tab or link. Prefer browser tab API if available.
  const foundTab = ext.model.tabs.find((el) => {
    return el.originalUrl === url
  })
  if (foundTab && ext.browserApi.tabs.highlight) {
    // Set the found tab active
    ext.browserApi.tabs.update(foundTab.originalId, {
      active: true,
    })
    // Switch browser window focus if necessary
    ext.browserApi.windows.update(foundTab.windowId, {
      focused: true,
    })
    window.close()
  } else if (ext.browserApi.tabs) {
    ext.browserApi.tabs.create({
      active: true,
      url: url,
    })
    window.close()
  } else {
    window.open(url, '_newtab')
  }
}

/**
 * Toggle the search approach between fuzzy and precise
 */
export async function toggleSearchApproach() {
  const userOptions = await getUserOptions()
  if (ext.opts.searchStrategy === 'precise') {
    ext.opts.searchStrategy = 'fuzzy'
  } else {
    ext.opts.searchStrategy = 'precise'
  }
  userOptions.searchStrategy = ext.opts.searchStrategy
  await setUserOptions(userOptions)
  updateSearchApproachToggle()
  search()
}

/**
 * Toggles the text and class of the search approach button
 */
export function updateSearchApproachToggle() {
  if (ext.opts.searchStrategy === 'fuzzy') {
    ext.dom.searchApproachToggle.innerText = 'FUZZY'
    ext.dom.searchApproachToggle.classList = 'fuzzy'
  } else if (ext.opts.searchStrategy === 'precise') {
    ext.dom.searchApproachToggle.innerText = 'PRECISE'
    ext.dom.searchApproachToggle.classList = 'precise'
  }
}
