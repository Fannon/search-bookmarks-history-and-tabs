/**
 * @file Handles user interaction events for search results.
 *
 * Responsibilities:
 * - Handle click/mouse events on search results with different behaviors based on modifiers and target elements.
 * - Manage tab closing, URL copying, and navigation flows.
 * - Switch between fuzzy and precise search strategies.
 * - Update search strategy toggle button appearance.
 * - Coordinate with search and navigation modules for result interactions.
 */

import { getUserOptions, setUserOptions } from '../model/options.js'
import { search } from '../search/common.js'
import { clearSelection, hoverResultItem } from './searchNavigation.js'
import { renderSearchResults } from './searchView.js'

// Module-level flag to track if event delegation has been set up.
// Using a module variable instead of a DOM property ensures the state
// survives any potential DOM replacement and prevents duplicate event listeners.
let eventDelegationSetup = false

/**
 * Handle click/mouse events on search results with different behaviors based on modifiers and target elements
 * Provides multiple ways to interact with search results (open, close tabs, navigate to tags/folders, etc.)
 */
export function openResultItem(event) {
  const resultEntry = document.getElementById('sel')

  if (event) {
    event.stopPropagation()

    // Handle browser compatibility for event target
    let target = event.target ? event.target : event.srcElement

    // Skip over highlight markup to get the actual element
    if (target.nodeName === 'MARK') {
      target = target.parentNode
    }

    // Handle clicks on special navigation elements (tags, folders, etc.)
    if (target?.getAttribute('x-link')) {
      window.location = target.getAttribute('x-link')
      return
    }

    // Handle close button clicks on tab entries
    // For close buttons, ALWAYS read from DOM to match the visually clicked item
    if (target?.className.includes('close')) {
      // Find the parent list item to get the correct originalId
      let listItem = target.parentElement
      while (listItem && listItem.nodeName !== 'LI') {
        listItem = listItem.parentElement
      }

      const originalIdFromDom = listItem?.getAttribute('x-original-id')
      const targetId = parseInt(originalIdFromDom, 10)

      // Close the browser tab
      ext.browserApi.tabs.remove(targetId)

      // Remove the item from the UI - use targetId to ensure we have a valid value
      const domElement = document.querySelector(`#results > li[x-original-id="${targetId}"]`)
      if (domElement) {
        domElement.remove()
      }

      // Update the application state - only remove if found (findIndex returns -1 if not found)
      const tabIndex = ext.model.tabs.findIndex((el) => el.originalId === targetId)
      if (tabIndex !== -1) {
        ext.model.tabs.splice(tabIndex, 1)
      }

      const resultIndex = ext.model.result.findIndex((el) => el.originalId === targetId)
      if (resultIndex !== -1) {
        ext.model.result.splice(resultIndex, 1)
      }

      // Clear the search cache to prevent ghost tabs in cached results
      if (ext.searchCache) {
        ext.searchCache.clear()
      }

      // Re-render to update indices and selection
      renderSearchResults()
      return
    }
  }

  // Determine which result to use based on event context
  // For mouse clicks on specific items, use the clicked item's index
  // For keyboard navigation (Enter key), use the currently selected item
  let selectedResult = null
  if (event?.target && typeof event.target.closest === 'function') {
    // Try to find the list item that was clicked
    const listItem = event.target.closest('li[x-index]')
    if (listItem) {
      const clickedIndex = parseInt(listItem.getAttribute('x-index'), 10)
      const hasValidIndex =
        Number.isInteger(clickedIndex) && clickedIndex >= 0 && clickedIndex < ext.model.result.length
      if (hasValidIndex) {
        selectedResult = ext.model.result[clickedIndex]
      }
    }
  }

  // Fall back to currently selected item if we couldn't determine clicked item
  if (!selectedResult) {
    selectedResult = ext.model.result[ext.model.currentItem]
  }

  // Final fallback to DOM attributes if model state is unavailable
  const url = selectedResult?.originalUrl ?? resultEntry?.getAttribute('x-open-url')

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
        .then((tabs) => {
          if (tabs && tabs.length > 0) {
            ext.browserApi.tabs.update(tabs[0].id, {
              url: url,
            })

            // Close popup unless Ctrl is also pressed
            if (!event.ctrlKey) {
              window.close()
            }
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
  // No validation needed here - the value is always valid since it's controlled by code
  userOptions.searchStrategy = ext.opts.searchStrategy
  await setUserOptions(userOptions)

  // Clear the search cache to prevent stale results from the previous strategy
  if (ext.searchCache) {
    ext.searchCache.clear()
  }

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
 * Set up event delegation for search result items
 * Uses a single event listener on the parent container for better memory efficiency
 * This is called from searchView.js after rendering results
 */
export function setupResultItemsEvents() {
  // Set up delegated event listeners only once
  if (eventDelegationSetup) {
    return
  }

  // Track actual mouse movement to prevent spurious hover selection on popup open
  ext.dom.resultList.addEventListener(
    'mousemove',
    () => {
      ext.model.mouseMoved = true
    },
    true,
  )

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
        listItem.id = 'sel'
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

  // Handle favicon load events (Capturing phase)
  // load and error do not bubble, so we must use capture: true
  ext.dom.resultList.addEventListener(
    'load',
    (event) => {
      const target = event.target
      if (target.nodeName === 'IMG' && target.classList.contains('favicon')) {
        target.classList.add('loaded')
      }
    },
    true,
  )

  // Handle favicon error events (Capturing phase)
  ext.dom.resultList.addEventListener(
    'error',
    (event) => {
      const target = event.target
      if (target.nodeName === 'IMG' && target.classList.contains('favicon')) {
        // If it fails, we just don't add .loaded, so the background icon remains visible
      }
    },
    true,
  )

  eventDelegationSetup = true
}
