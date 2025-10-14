/**
 * SEARCH VIEW MODULE
 *
 * Handles the user interface and interaction for the search results display.
 * This module is responsible for:
 * - Rendering search results (bookmarks and open tabs) in a structured list format
 * - Managing visual selection and keyboard/mouse navigation between results
 * - Handling various click behaviors (open in tab, close tab, copy URL, etc.)
 * - Displaying result metadata (tags, folders, visit counts, dates, scores)
 * - Supporting search term highlighting and search strategy switching
 */

import { timeSince } from '../helper/utils.js'
import { getUserOptions, setUserOptions } from '../model/options.js'
import { search } from '../search/common.js'

/**
 * Render the search results in UI as result items
 */
export async function renderSearchResults(result) {
  result = result || ext.model.result

  if (!result || result.length === 0) {
    ext.dom.resultList.replaceChildren()
    return
  }

  // Prepare for rendering - disable hover until results are fully rendered
  ext.model.mouseHoverEnabled = false

  // Cache configuration values for this render cycle
  const opts = ext.opts
  const shouldHighlight = opts.displaySearchMatchHighlight
  const searchTerm = ext.model.searchTerm

  // Set up right-click context menu prevention (one-time setup)
  if (!document.hasContextMenuListener) {
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault()
    })
    document.hasContextMenuListener = true
  }

  // Use DocumentFragment to batch DOM updates for smoother rendering
  const fragment = document.createDocumentFragment()

  for (let i = 0; i < result.length; i++) {
    const resultEntry = result[i]

    if (!resultEntry) {
      continue
    }

    // Create the main list item element with appropriate attributes
    const resultListItem = document.createElement('li')
    resultListItem.className = resultEntry.type
    resultListItem.setAttribute('x-open-url', resultEntry.originalUrl)
    resultListItem.setAttribute('x-index', i)
    resultListItem.setAttribute('x-original-id', resultEntry.originalId)

    // Apply colored left border based on result type (bookmark, tab, etc.)
    const colorKey = resultEntry.type + 'Color'
    resultListItem.style.cssText = `border-left: ${opts.colorStripeWidth}px solid ${opts[colorKey]}`

    // Add edit button for bookmark entries
    if (resultEntry.type === 'bookmark') {
      const editImg = document.createElement('img')
      editImg.className = 'edit-button'
      editImg.setAttribute('x-link', '#edit-bookmark/' + resultEntry.originalId)
      editImg.title = 'Edit Bookmark'
      editImg.src = '../images/edit.svg'
      resultListItem.appendChild(editImg)
    }

    // Add close button for tab entries
    if (resultEntry.type === 'tab') {
      const closeImg = document.createElement('img')
      closeImg.className = 'close-button'
      closeImg.title = 'Close Tab'
      closeImg.src = '../images/x.svg'
      resultListItem.appendChild(closeImg)
    }

    // Create container for title and metadata
    const titleDiv = document.createElement('div')
    titleDiv.className = 'title'

    // Create the title text element with highlighting support
    const titleText = document.createElement('span')
    titleText.className = 'title-text'

    if (shouldHighlight) {
      // Use pre-highlighted content if available, otherwise fall back to plain text
      const content = resultEntry.titleHighlighted || resultEntry.title || resultEntry.urlHighlighted || resultEntry.url
      if (content && content.includes('<mark>')) {
        titleText.innerHTML = content + ' '
      } else {
        titleText.innerText = content + ' '
      }
    } else {
      // Display title or URL as fallback
      const titleContent = resultEntry.title || resultEntry.url + ' '
      titleText.innerText = titleContent
    }
    titleDiv.appendChild(titleText)

    // Batch badge creation for better performance
    const badgeContainer = document.createDocumentFragment()

    // Add clickable tag badges for bookmark entries
    if (opts.displayTags && resultEntry.tagsArray) {
      for (const tag of resultEntry.tagsArray) {
        const el = document.createElement('span')
        el.title = 'Bookmark Tags'
        el.className = 'badge tags'
        el.setAttribute('x-link', `#search/#${tag}`)
        el.innerText = shouldHighlight ? '#' + tag : '#' + tag
        badgeContainer.appendChild(el)
      }
    }

    // Add clickable folder path badges for bookmark entries
    if (opts.displayFolderName && resultEntry.folderArray) {
      const trail = []
      for (const f of resultEntry.folderArray) {
        trail.push(f)
        const el = document.createElement('span')
        el.title = 'Bookmark Folder'
        el.className = 'badge folder'
        el.setAttribute('x-link', `#search/~${trail.join(' ~')}`)
        if (opts.bookmarkColor) {
          el.style.cssText = `background-color: ${opts.bookmarkColor}`
        }
        el.innerText = shouldHighlight ? '~' + f : '~' + f
        badgeContainer.appendChild(el)
      }
    }

    // Add relative visit time badge (e.g., "2 hours ago")
    if (opts.displayLastVisit && resultEntry.lastVisitSecondsAgo) {
      const lastVisit = timeSince(new Date(Date.now() - resultEntry.lastVisitSecondsAgo * 1000))
      const lastVisited = document.createElement('span')
      lastVisited.title = 'Last Visited'
      lastVisited.className = 'badge last-visited'
      lastVisited.innerText = '-' + lastVisit
      badgeContainer.appendChild(lastVisited)
    }

    // Add visit count badge showing how many times the page was visited
    if (opts.displayVisitCounter && resultEntry.visitCount !== undefined) {
      const visitCounter = document.createElement('span')
      visitCounter.title = 'Visited Counter'
      visitCounter.className = 'badge visit-counter'
      visitCounter.innerText = resultEntry.visitCount
      badgeContainer.appendChild(visitCounter)
    }

    // Add date when bookmark was added
    if (opts.displayDateAdded && resultEntry.dateAdded) {
      const dateAdded = document.createElement('span')
      dateAdded.title = 'Date Added'
      dateAdded.className = 'badge date-added'
      dateAdded.innerText = new Date(resultEntry.dateAdded).toISOString().split('T')[0]
      badgeContainer.appendChild(dateAdded)
    }

    // Add relevance score badge for search result ranking
    if (opts.displayScore && resultEntry.score) {
      const score = document.createElement('span')
      score.title = 'Score'
      score.className = 'badge score'
      score.innerText = Math.round(resultEntry.score)
      badgeContainer.appendChild(score)
    }

    // Append all badges at once
    titleDiv.appendChild(badgeContainer)

    // Create and populate URL display section
    const urlDiv = document.createElement('div')
    urlDiv.className = 'url'
    urlDiv.title = resultEntry.url
    if (shouldHighlight && resultEntry.urlHighlighted && resultEntry.urlHighlighted.includes('<mark>')) {
      urlDiv.innerHTML = resultEntry.urlHighlighted
    } else {
      urlDiv.innerText = resultEntry.url
    }

    // Assemble the complete result item
    resultListItem.appendChild(titleDiv)
    resultListItem.appendChild(urlDiv)

    // Enable interaction with the result item
    resultListItem.addEventListener('mouseenter', hoverResultItem)
    resultListItem.addEventListener('mouseup', openResultItem)

    // Apply client-side text highlighting for search terms if needed
    if (shouldHighlight && searchTerm && window.Mark) {
      if (!resultEntry.titleHighlighted || !resultEntry.urlHighlighted) {
        const mark = new window.Mark(resultListItem)
        mark.mark(searchTerm)
      }
    }

    fragment.appendChild(resultListItem)
  }

  // Update the DOM with all new result items at once
  ext.dom.resultList.replaceChildren(fragment)

  // Highlight the first result as the current selection
  selectListItem(0)
}

//////////////////////////////////////////
// SEARCH VIEW NAVIGATION               //
//////////////////////////////////////////

/**
 * Handle keyboard navigation for search results
 * Supports arrow keys and vim-style keybindings (Ctrl+P/Ctrl+N, Ctrl+K/Ctrl+J)
 */
export function navigationKeyListener(event) {
  // Define navigation directions with multiple keybinding options
  const up = event.key === 'ArrowUp' || (event.ctrlKey && event.key === 'p') || (event.ctrlKey && event.key === 'k')
  const down = event.key === 'ArrowDown' || (event.ctrlKey && event.key === 'n') || (event.ctrlKey && event.key === 'j')

  if (up && ext.dom.searchInput.value && ext.model.currentItem === 0) {
    // Prevent navigation above first item when search field has content
    event.preventDefault()
  } else if (up && ext.model.currentItem > 0) {
    // Navigate to previous result
    event.preventDefault()
    selectListItem(ext.model.currentItem - 1, true)
  } else if (down && ext.model.currentItem < ext.model.result.length - 1) {
    // Navigate to next result
    event.preventDefault()
    selectListItem(ext.model.currentItem + 1, true)
  } else if (event.key === 'Enter' && ext.model.result.length > 0) {
    // Activate selected result when Enter is pressed
    if (window.location.hash.startsWith('#search/') || !window.location.hash) {
      openResultItem(event)
    }
  } else if (event.key === 'Escape') {
    // Return to search mode and focus the search input
    window.location.hash = '#search/'
    ext.dom.searchInput.focus()
  }
}

/**
 * Update the visual selection state of result items
 * Removes previous selection and applies new selection with optional scrolling
 */
export function selectListItem(index, scroll = false) {
  // Clear existing selection
  const currentSelection = document.getElementById('selected-result')
  if (currentSelection) {
    currentSelection.id = ''
    delete currentSelection.id
  }

  // Apply new selection if the item exists
  if (ext.dom.resultList.children[index]) {
    ext.dom.resultList.children[index].id = 'selected-result'

    // Smoothly scroll the selected item into view if requested
    if (scroll) {
      ext.dom.resultList.children[index].scrollIntoView({
        behavior: 'auto',
        block: 'nearest',
      })
    }
  }

  // Update the application state to reflect the new selection
  ext.model.currentItem = index
}

/**
 * Handle mouse hover events on result items to update selection
 * Includes protection against spurious hover events during rendering
 */
export function hoverResultItem(event) {
  const target = event.target ? event.target : event.srcElement
  const index = target.getAttribute('x-index')

  // Prevent hover events during the initial render phase
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
 * Handle click/mouse events on search results with different behaviors based on modifiers and target elements
 * Provides multiple ways to interact with search results (open, close tabs, navigate to tags/folders, etc.)
 */
export function openResultItem(event) {
  const resultEntry = document.getElementById('selected-result')
  const originalId = resultEntry.getAttribute('x-original-id')
  const url = resultEntry.getAttribute('x-open-url')

  if (event) {
    event.stopPropagation()

    // Handle browser compatibility for event target
    let target = event.target ? event.target : event.srcElement

    // Skip over highlight markup to get the actual element
    if (target.nodeName === 'MARK') {
      target = target.parentNode
    }

    // Handle clicks on special navigation elements (tags, folders, etc.)
    if (target && target.getAttribute('x-link')) {
      window.location = target.getAttribute('x-link')
      return
    }

    // Handle close button clicks on tab entries
    if (target && target.className.includes('close-button')) {
      const targetId = parseInt(originalId)

      // Close the browser tab
      ext.browserApi.tabs.remove(targetId)

      // Remove the item from the UI
      document.querySelector(`#result-list > li[x-original-id="${originalId}"]`).remove()

      // Update the application state
      ext.model.tabs.splice(
        ext.model.tabs.findIndex((el) => el.originalId === targetId),
        1,
      )
      ext.model.result.splice(
        ext.model.result.findIndex((el) => el.originalId === targetId),
        1,
      )

      // Re-render to update indices and selection
      renderSearchResults()
      return
    }
  }

  // Handle right-click to copy URL to clipboard
  if (event.button === 2) {
    navigator.clipboard.writeText(url)
    event.preventDefault()
    return
  }

  // Handle Shift/Alt modifiers - open in current tab
  if (event.shiftKey || event.altKey) {
    if (ext.browserApi.tabs) {
      // Use browser tabs API to update current tab
      ext.browserApi.tabs
        .query({
          active: true,
          currentWindow: true,
        })
        .then(([currentTab]) => {
          ext.browserApi.tabs.update(currentTab.id, {
            url: url,
          })

          // Close popup unless Ctrl is also pressed
          if (!event.ctrlKey) {
            window.close()
          }
        })
        .catch(console.error)
    } else {
      // Fallback for non-extension environments
      window.location.href = url
    }
    return
  }

  // Handle Ctrl modifier - open in background tab
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

  // Default behavior - open in new tab or switch to existing tab
  const foundTab = ext.model.tabs.find((el) => {
    return el.originalUrl === url
  })

  if (foundTab && ext.browserApi.tabs.highlight) {
    // Switch to existing tab if found
    ext.browserApi.tabs.update(foundTab.originalId, {
      active: true,
    })
    ext.browserApi.windows.update(foundTab.windowId, {
      focused: true,
    })
    window.close()
  } else if (ext.browserApi.tabs) {
    // Create new tab as active
    ext.browserApi.tabs.create({
      active: true,
      url: url,
    })
    window.close()
  } else {
    // Fallback for non-extension environments
    window.open(url, '_newtab')
  }
}

/**
 * Switch between fuzzy and precise search strategies
 * Updates user preferences and refreshes search results with the new strategy
 */
export async function toggleSearchApproach() {
  // Load current user preferences
  const userOptions = await getUserOptions()

  // Toggle the current search strategy
  if (ext.opts.searchStrategy === 'precise') {
    ext.opts.searchStrategy = 'fuzzy'
  } else {
    ext.opts.searchStrategy = 'precise'
  }

  // Persist the new strategy to user preferences
  userOptions.searchStrategy = ext.opts.searchStrategy
  await setUserOptions(userOptions)

  // Update the UI to reflect the new strategy
  updateSearchApproachToggle()

  // Re-run search with the new strategy
  search()
}

/**
 * Update the search strategy toggle button appearance
 * Changes both the displayed text and CSS class based on current strategy
 */
export function updateSearchApproachToggle() {
  ext.dom.searchApproachToggle.innerText = ext.opts.searchStrategy.toUpperCase()
  ext.dom.searchApproachToggle.classList = ext.opts.searchStrategy
}
