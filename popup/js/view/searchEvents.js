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
import { hoverResultItem, clearSelection } from './searchNavigation.js'
import { renderSearchResults } from './searchView.js'

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
 * Set up event delegation for search result items
 * Uses a single event listener on the parent container for better memory efficiency
 * This is called from searchView.js after rendering results
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
