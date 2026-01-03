/**
 * @file Manages keyboard and mouse navigation for search results.
 *
 * Responsibilities:
 * - Handle keyboard navigation with arrow keys and vim-style keybindings (Ctrl+P/Ctrl+N, Ctrl+K/Ctrl+J).
 * - Manage visual selection state of result items with scrolling support.
 * - Handle mouse hover events to update selection only after actual mouse movement.
 * - Coordinate with search result rendering to maintain proper selection state.
 */

import { openResultItem, toggleSearchApproach } from './searchEvents.js'

/**
 * Handle keyboard navigation for search results
 * Supports arrow keys and vim-style keybindings (Ctrl+P/Ctrl+N, Ctrl+K/Ctrl+J)
 */
export async function navigationKeyListener(event) {
  // Define navigation directions with multiple keybinding options
  const up = event.key === 'ArrowUp' || (event.ctrlKey && event.key === 'p') || (event.ctrlKey && event.key === 'k')
  const down = event.key === 'ArrowDown' || (event.ctrlKey && event.key === 'n') || (event.ctrlKey && event.key === 'j')

  // Toggle fuzzy/precise search with Ctrl+F
  if (event.ctrlKey && (event.key === 'f' || event.key === 'F')) {
    event.preventDefault()
    await toggleSearchApproach()
    return
  }

  // Handle Tab key to insert two spaces for hybrid search separator
  if (event.key === 'Tab') {
    if (document.activeElement === ext.dom.searchInput) {
      event.preventDefault()
      const input = ext.dom.searchInput
      const start = input.selectionStart
      const end = input.selectionEnd
      const value = input.value

      // Insert two spaces
      input.value = `${value.substring(0, start)}  ${value.substring(end)}`

      // Move cursor after the inserted spaces
      input.selectionStart = input.selectionEnd = start + 2

      // Trigger input event to update search results
      input.dispatchEvent(new Event('input'))
      return
    }
  }

  if (up) {
    // Always consume vim-style/arrow up to prevent browser defaults from closing popup
    event.preventDefault()
    if (ext.model.currentItem > 0) {
      selectListItem(ext.model.currentItem - 1, true)
    }
    return
  }

  if (down) {
    // Always consume vim-style/arrow down to prevent browser defaults from closing popup
    event.preventDefault()
    if (ext.model.currentItem < ext.model.result.length - 1) {
      selectListItem(ext.model.currentItem + 1, true)
    }
    return
  }

  if (event.key === 'Enter' && ext.model.result.length > 0) {
    // Activate selected result when Enter is pressed
    if (window.location.hash.startsWith('#search/') || !window.location.hash) {
      // Wait for any in-flight search to complete before opening result
      // This prevents race condition where Enter is pressed before search finishes
      if (ext.model.activeSearchPromise) {
        await ext.model.activeSearchPromise
      }
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
    ext.dom.resultList.children[index].id = 'sel'

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
  const currentSelection = document.getElementById('sel')
  if (currentSelection) {
    currentSelection.id = ''
    currentSelection.removeAttribute('id')
  }
}

/**
 * Handle mouse hover events on result items to update selection
 * Only allows selection after the user has actually moved their mouse,
 * preventing spurious selection when popup opens with cursor over results
 */
export function hoverResultItem(event) {
  const target = event.target ? event.target : event.srcElement
  const index = target.getAttribute('x-index')

  // Only allow hover selection after mouse has actually moved
  if (!ext.model.mouseMoved) {
    return
  }

  if (index) {
    selectListItem(index)
  } else {
    console.warn('Could not hover result item', target, event)
  }
}
