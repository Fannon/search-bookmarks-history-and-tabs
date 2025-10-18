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

import { escapeHtml, timeSince } from '../helper/utils.js'
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
  const searchTermSuffix = `/search/${encodeURIComponent(searchTerm || '')}`

  for (let i = 0; i < result.length; i++) {
    const resultEntry = result[i]

    if (!resultEntry) {
      continue
    }

    let badgesHTML = ''

    if (opts.displayTags && resultEntry.tagsArray) {
      for (const tag of resultEntry.tagsArray) {
        const safeTag = escapeHtml(tag)
        badgesHTML += `<span class="badge tags" x-link="#search/#${safeTag}" title="Bookmark Tags">#${safeTag}</span>`
      }
    }

    if (opts.displayFolderName && resultEntry.folderArray) {
      const trail = []
      for (const folderName of resultEntry.folderArray) {
        trail.push(folderName)
        const folderLink = `#search/~${trail.join(' ~')}`
        const safeLink = escapeHtml(folderLink)
        const label = `~${folderName}`
        badgesHTML += `<span class="badge folder" x-link="${safeLink}" title="Bookmark Folder" style="background-color: ${escapeHtml(
          String(opts.bookmarkColor || 'none'),
        )}">${escapeHtml(label)}</span>`
      }
    }

    if (opts.displayLastVisit && resultEntry.lastVisitSecondsAgo) {
      const lastVisit = timeSince(new Date(Date.now() - resultEntry.lastVisitSecondsAgo * 1000))
      badgesHTML += `<span class="badge last-visited" title="Last Visited">-${escapeHtml(lastVisit)}</span>`
    }

    if (opts.displayVisitCounter && resultEntry.visitCount !== undefined) {
      badgesHTML += `<span class="badge visit-counter" title="Visited Counter">${escapeHtml(
        String(resultEntry.visitCount),
      )}</span>`
    }

    if (opts.displayDateAdded && resultEntry.dateAdded) {
      badgesHTML += `<span class="badge date-added" title="Date Added">${escapeHtml(
        new Date(resultEntry.dateAdded).toISOString().split('T')[0],
      )}</span>`
    }

    if (opts.displayScore && resultEntry.score) {
      badgesHTML += `<span class="badge score" title="Score">${escapeHtml(String(Math.round(resultEntry.score)))}</span>`
    }

    const highlightCandidate =
      resultEntry.titleHighlighted || resultEntry.title || resultEntry.urlHighlighted || resultEntry.url || ''
    const titleContent = shouldHighlight && searchTerm && searchTerm.trim()
      ? escapeHtml(highlightCandidate).replace(/&lt;(\/?)mark&gt;/gi, '<$1mark>')
      : escapeHtml(resultEntry.title || resultEntry.url || '')

    const urlContent =
      shouldHighlight && searchTerm && searchTerm.trim() && resultEntry.urlHighlighted
        ? escapeHtml(resultEntry.urlHighlighted).replace(/&lt;(\/?)mark&gt;/gi, '<$1mark>')
        : escapeHtml(resultEntry.url || '')

    const typeClass = escapeHtml(resultEntry.type || '')
    const originalUrlAttr = resultEntry.originalUrl ? ` x-open-url="${escapeHtml(resultEntry.originalUrl)}"` : ''
    const originalIdAttr =
      resultEntry.originalId !== undefined ? ` x-original-id="${escapeHtml(String(resultEntry.originalId))}"` : ''
    const colorValue = escapeHtml(String(opts[resultEntry.type + 'Color']))

    const itemHTML = `
      <li class="${typeClass}"${originalUrlAttr} x-index="${i}"${originalIdAttr}
          style="border-left: ${opts.colorStripeWidth}px solid ${colorValue}">
        ${
          resultEntry.type === 'bookmark'
            ? `<img class="edit-button" x-link="./editBookmark.html#bookmark/${encodeURIComponent(
                resultEntry.originalId,
              )}${searchTermSuffix}" title="Edit Bookmark" src="./img/edit.svg">`
            : ''
        }
        ${resultEntry.type === 'tab' ? '<img class="close-button" title="Close Tab" src="./img/x.svg">' : ''}
        <div class="title">
          <span class="title-text">${titleContent} </span>
          ${badgesHTML}
        </div>
        <div class="url" title="${escapeHtml(resultEntry.url || '')}">${urlContent}</div>
      </li>
    `

    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = itemHTML
    const resultListItem = tempDiv.firstElementChild

    if (shouldHighlight && searchTerm && searchTerm.trim() && window.Mark) {
      if (!resultEntry.titleHighlighted || !resultEntry.urlHighlighted) {
        const mark = new window.Mark(resultListItem)
        mark.mark(searchTerm, {
          exclude: ['.last-visited', '.score', '.visit-counter', '.date-added'],
        })
      }
    }

    fragment.appendChild(resultListItem)
  }

  // Update the DOM with all new result items at once
  ext.dom.resultList.replaceChildren(fragment)

  // Highlight the first result as the current selection
  selectListItem(0)

  // Set up event delegation for better performance (one-time setup)
  setupResultItemsEvents()
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
  clearSelection()

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
 * Clear the currently selected result item
 */
export function clearSelection() {
  const currentSelection = document.getElementById('selected-result')
  if (currentSelection) {
    currentSelection.id = ''
    currentSelection.removeAttribute('id')
  }
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

/**
 * Set up events for search result items
 * Uses a single event listener on the parent container for better memory efficiency (event delegation)
 */
export function setupResultItemsEvents() {
  // Set up delegated event listeners only once
  if (ext.dom.resultList.hasEventDelegation) {
    return
  }

  // Handle mouse enter events for hover effects
  ext.dom.resultList.addEventListener(
    'mouseenter',
    (event) => {
      const listItem = event.target.closest('li[x-index]')
      if (listItem) {
        hoverResultItem({
          target: listItem,
          srcElement: listItem,
        })
      }
    },
    true,
  )

  // Handle mouse up events for clicks and interactions
  ext.dom.resultList.addEventListener(
    'mouseup',
    (event) => {
      const listItem = event.target.closest('li[x-index]')
      if (listItem) {
        // Update selection for this item
        clearSelection()
        listItem.id = 'selected-result'
        openResultItem({
          target: event.target,
          srcElement: event.target,
          button: event.button,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          ctrlKey: event.ctrlKey,
          stopPropagation: () => event.stopPropagation(),
        })
      }
    },
    true,
  )

  ext.dom.resultList.hasEventDelegation = true
}
