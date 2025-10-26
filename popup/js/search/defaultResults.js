/**
 * @file Default result generation when no search term is provided.
 *
 * Responsibilities:
 * - Build default result sets based on current search mode.
 * - Surface bookmarks matching the current tab's URL.
 * - Show recently accessed tabs when no search is active.
 * - Provide mode-specific defaults (history, tabs, bookmarks).
 *
 * This module ensures users always see relevant content even with an empty search,
 * improving the initial browsing experience and discoverability.
 */

import { getBrowserTabs } from '../helper/browserApi.js'

/**
 * Attach a default `searchScore` of 1 to a result entry.
 *
 * @param {Object} entry - Result entry to enrich.
 * @returns {Object} Entry with searchScore property.
 */
const withDefaultScore = (entry) => ({
  searchScore: 1,
  ...entry,
})

/**
 * Build default result sets when no explicit search term is provided.
 *
 * The default results vary by search mode:
 * - **history**: Recent history entries
 * - **tabs**: All tabs sorted by recency
 * - **bookmarks**: All bookmarks
 * - **all** (default): Bookmarks matching current tab + recent tabs
 *
 * @returns {Promise<Array>} Result entries enriched with default scores.
 *
 * @example
 * // In history mode with ext.model.history populated
 * await addDefaultEntries()
 * // Returns: [{ ...historyItem1, searchScore: 1 }, { ...historyItem2, searchScore: 1 }]
 */
export async function addDefaultEntries() {
  let results = []

  if (ext.model.searchMode === 'history' && ext.model.history) {
    // Display recent history by default
    results = ext.model.history.map(withDefaultScore)
  } else if (ext.model.searchMode === 'tabs' && ext.model.tabs) {
    // Display last opened tabs by default
    results = ext.model.tabs.map(withDefaultScore).sort((a, b) => {
      return a.lastVisitSecondsAgo - b.lastVisitSecondsAgo
    })
  } else if (ext.model.searchMode === 'bookmarks' && ext.model.bookmarks) {
    // Display all bookmarks by default
    results = ext.model.bookmarks.map(withDefaultScore)
  } else {
    // Default: Find bookmarks that match current page URL
    try {
      const [tab] = await getBrowserTabs({ active: true, currentWindow: true })
      if (tab && tab.url) {
        // Use the current tab's URL instead of window.location.href for accuracy
        const currentUrl = tab.url.replace(/[/#]$/, '')

        // Find bookmarks that match current page URL (with some flexibility)
        const matchingBookmarks = ext.model.bookmarks.filter((el) => {
          if (!el.originalUrl) return false
          const bookmarkUrl = el.originalUrl.replace(/[/#]$/, '')
          return (
            bookmarkUrl === currentUrl ||
            bookmarkUrl === currentUrl.replace(/^https?:\/\//, '') ||
            currentUrl === bookmarkUrl.replace(/^https?:\/\//, '')
          )
        })

        if (matchingBookmarks.length > 0) {
          results.push(...matchingBookmarks.map(withDefaultScore))
        }
      }
    } catch (err) {
      console.warn('Could not get current tab for default entries:', err)
    }

    // Always add recently visited tabs when option is enabled and no search term
    if (ext.model.tabs && ext.opts.maxRecentTabsToShow > 0) {
      const recentTabs = ext.model.tabs
        .filter(
          (tab) =>
            tab &&
            tab.url &&
            !tab.url.startsWith('chrome://') &&
            !tab.url.startsWith('about:'),
        )
        .map(withDefaultScore)
        .sort((a, b) => {
          // Sort by last accessed time (most recent first)
          // Handle cases where last accessed might be undefined
          const aTime = a.lastVisitSecondsAgo || Number.MAX_SAFE_INTEGER
          const bTime = b.lastVisitSecondsAgo || Number.MAX_SAFE_INTEGER
          return aTime - bTime
        })
        .slice(0, ext.opts.maxRecentTabsToShow) // Show most recent tabs

      results.push(...recentTabs)
    }
  }

  ext.model.result = results
  return results
}
