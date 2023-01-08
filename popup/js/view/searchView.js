//////////////////////////////////////////
// SEARCH VIEW                          //
//////////////////////////////////////////

import { initExtension } from '../initSearch.js'
import { getUserOptions, setUserOptions } from '../model/options.js'

/**
 * Render the search results in UI as result items
 */
export function renderSearchResults(result) {
  result = result || ext.model.result

  // performance.mark('render-start')

  ext.model.mouseHoverEnabled = false
  const resultListItems = []

  for (let i = 0; i < result.length; i++) {
    const resultEntry = result[i]

    if (!resultEntry) {
      continue
    }

    // Create result list item (li)
    const resultListItem = document.createElement('li')
    resultListItem.classList.add(resultEntry.type)
    resultListItem.setAttribute('x-open-url', resultEntry.originalUrl)
    resultListItem.setAttribute('x-index', i)
    resultListItem.setAttribute('x-original-id', resultEntry.originalId)

    // Create edit button / image
    if (resultEntry.type === 'bookmark') {
      const editImg = document.createElement('img')
      editImg.classList.add('edit-button')
      editImg.title = 'Edit Bookmark'
      editImg.src = '../images/edit.svg'
      resultListItem.appendChild(editImg)
    }

    // Create edit button / image
    if (resultEntry.type === 'tab') {
      const closeImg = document.createElement('img')
      closeImg.classList.add('close-button')
      closeImg.title = 'Close Tab'
      closeImg.src = '../images/x.svg'
      resultListItem.appendChild(closeImg)
    }

    // Create title div
    const titleDiv = document.createElement('div')
    titleDiv.classList.add('title')

    if (ext.opts.displaySearchMatchHighlight) {
      const content = resultEntry.titleHighlighted || resultEntry.title || resultEntry.urlHighlighted || resultEntry.url
      if (content.includes('<mark>')) {
        titleDiv.innerHTML = content + ' '
      } else {
        titleDiv.innerText = content + ' '
      }
    } else {
      titleDiv.innerText = resultEntry.title | (resultEntry.url + ' ')
    }
    if (ext.opts.displayTags && resultEntry.tags) {
      const tags = document.createElement('span')
      tags.title = 'Bookmark Tags'
      tags.classList.add('badge', 'tags')
      if (
        ext.opts.displaySearchMatchHighlight &&
        resultEntry.tagsHighlighted &&
        resultEntry.tagsHighlighted.includes('<mark>')
      ) {
        tags.innerHTML = resultEntry.tagsHighlighted
      } else {
        tags.innerText = resultEntry.tags
      }
      titleDiv.appendChild(tags)
    }
    if (ext.opts.displayFolderName && resultEntry.folder) {
      const folder = document.createElement('span')
      folder.title = 'Bookmark Folder'
      folder.classList.add('badge', 'folder')
      if (
        ext.opts.displaySearchMatchHighlight &&
        resultEntry.folderHighlighted &&
        resultEntry.folderHighlighted.includes('<mark>')
      ) {
        folder.innerHTML = resultEntry.folderHighlighted
      } else {
        folder.innerText = resultEntry.folder
      }
      titleDiv.appendChild(folder)
    }
    if (ext.opts.displayLastVisit && resultEntry.lastVisit) {
      const lastVisited = document.createElement('span')
      lastVisited.title = 'Last Visited'
      lastVisited.classList.add('badge', 'last-visited')
      lastVisited.innerText = '-' + resultEntry.lastVisit
      titleDiv.appendChild(lastVisited)
    }
    if (ext.opts.displayVisitCounter && resultEntry.visitCount) {
      const visitCounter = document.createElement('span')
      visitCounter.title = 'Visited Counter'
      visitCounter.classList.add('badge', 'visit-counter')
      visitCounter.innerText = resultEntry.visitCount
      titleDiv.appendChild(visitCounter)
    }
    if (ext.opts.displayDateAdded && resultEntry.dateAdded) {
      const dateAdded = document.createElement('span')
      dateAdded.title = 'Date Added'
      dateAdded.classList.add('badge', 'date-added')
      dateAdded.innerText = new Date(resultEntry.dateAdded).toISOString().split('T')[0]
      titleDiv.appendChild(dateAdded)
    }
    if (ext.opts.tabsDisplayWindowId && resultEntry.windowId) {
      const windowId = document.createElement('span')
      windowId.title = 'Window'
      windowId.classList.add('badge', 'window')
      windowId.innerText = Math.round(resultEntry.windowId)
      titleDiv.appendChild(windowId)
    }
    if (ext.opts.displayScore && resultEntry.score) {
      const score = document.createElement('span')
      score.title = 'Score'
      score.classList.add('badge', 'score')
      score.innerText = Math.round(resultEntry.score)
      titleDiv.appendChild(score)
    }

    // Create URL div
    const urlDiv = document.createElement('div')
    urlDiv.classList.add('url')
    if (
      ext.opts.displaySearchMatchHighlight &&
      resultEntry.urlHighlighted &&
      resultEntry.urlHighlighted.includes('<mark>')
    ) {
      urlDiv.innerHTML = resultEntry.urlHighlighted
    } else {
      urlDiv.innerText = resultEntry.url
    }

    // Append everything together :)
    resultListItem.appendChild(titleDiv)
    resultListItem.appendChild(urlDiv)
    resultListItem.addEventListener('mouseenter', hoverResultItem)
    resultListItem.addEventListener('mouseup', openResultItem)

    if (ext.opts.displaySearchMatchHighlight && ext.model.searchTerm) {
      // Use mark.js to highlight search results, if we don't have already done before in fuzzy search
      if (!resultEntry.titleHighlighted || !resultEntry.urlHighlighted) {
        const markInstance = new Mark(resultListItem)
        markInstance.mark(ext.model.searchTerm)
      }
    }
    resultListItems.push(resultListItem)
  }

  // Replace current results with new results
  ext.dom.resultList.replaceChildren(...resultListItems)

  // mark first result item as selected
  selectListItem(0)

  // performance.mark('render-end')
  // performance.measure('Render DOM', 'render-start', 'render-end')
  // const renderPerformance = performance.getEntriesByType('measure')
  // console.debug('Render Performance: ' + renderPerformance[0].duration + 'ms', renderPerformance)
  // performance.clearMeasures()
}

//////////////////////////////////////////
// SEARCH VIEW NAVIGATION               //
//////////////////////////////////////////

/**
 * General key listener that detects keyboard navigation
 * -> Arrow up, Arrow Down, Enter
 */
export function navigationKeyListener(event) {
  if (event.key === 'ArrowUp' && ext.dom.searchInput.value && ext.model.currentItem == 0) {
    event.preventDefault()
  } else if (event.key === 'ArrowUp' && ext.model.currentItem > 0) {
    ext.model.currentItem--
    event.preventDefault()
    selectListItem(ext.model.currentItem, true)
  } else if (event.key === 'ArrowDown' && ext.model.currentItem < ext.model.result.length - 1) {
    ext.model.currentItem++
    selectListItem(ext.model.currentItem, true)
  } else if (event.key === 'Enter' && ext.model.result.length > 0) {
    // Enter selects selected search result -> only when in search mode
    if (window.location.hash.startsWith('#search/')) {
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
    const target = event.target ? event.target : event.srcElement

    // If the event is a click event on the edit image:
    // Do not go to the URL itself, but to the internal edit bookmark url
    if (target && target.className.includes('edit-button')) {
      window.location = '#edit-bookmark/' + originalId
      return
    } else if (target && target.className.includes('close-button')) {
      const targetId = parseInt(originalId)

      // Close Browser Tab
      ext.browserApi.tabs.remove(targetId)

      // Remove search list entry
      document.querySelector(`#result-list > li[x-original-id="${originalId}"]`).remove(targetId)

      // Remove closed tab from index model
      ext.model.tabs.splice(
        ext.model.tabs.findIndex((el) => el.originalId === targetId),
        1,
      )

      // Remove closed tab from search result
      ext.model.result.splice(
        ext.model.result.findIndex((el) => el.originalId === targetId),
        1,
      )

      // Render search results again to avoid display bugs
      renderSearchResults()

      return
    }
  }

  // If we press SHIFT or ALT while selecting an entry:
  // -> Open it in current tab
  if (event.shiftKey || event.altKey) {
    console.debug('Open in current tab: ' + url)
    if (ext.browserApi.tabs) {
      ext.browserApi.tabs
        .query({
          active: true,
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

  // If we press CTRL while selecting an entry
  // -> Open it in new tab in the background (don't close popup)
  if (event.ctrlKey) {
    console.debug('Open in background tab: ' + url)
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

  // If we use no modifier when selecting an entry:
  // -> Navigate to selected tab or link. Prefer browser tab API if available.
  const foundTab = ext.model.tabs.find((el) => {
    return el.originalUrl === url
  })

  if (foundTab && ext.browserApi.tabs.highlight) {
    console.debug('Open in existing tab: ' + url)

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
    console.debug('Open in new, active tab: ' + url)
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
  } else if (ext.opts.searchStrategy === 'fuzzy') {
    ext.opts.searchStrategy = 'hybrid'
  } else {
    ext.opts.searchStrategy = 'precise'
  }

  userOptions.searchStrategy = ext.opts.searchStrategy

  // Update user options
  await setUserOptions(userOptions)
  // Init extension again
  await initExtension()
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
  } else if (ext.opts.searchStrategy === 'hybrid') {
    ext.dom.searchApproachToggle.innerText = 'HYBRID'
    ext.dom.searchApproachToggle.classList = 'hybrid'
  }
}
