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
import { cleanUpUrl } from '../helper/utils.js'

const UNBOOKMARKABLE_URL_PREFIXES = [
  'about:',
  'brave:',
  'chrome:',
  'chrome-extension:',
  'data:',
  'edge:',
  'file:',
  'javascript:',
  'moz-extension:',
  'opera:',
  'vivaldi:',
]

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
 * // Returns: [{ ...historyItem1 }, { ...historyItem2 }]
 */
export async function addDefaultEntries() {
  let results = []

  if (ext.model.searchMode === 'history' && ext.model.history) {
    // Display recent history by default
    results = ext.model.history.map((el) => ({ ...el }))
  } else if (ext.model.searchMode === 'tabs' && ext.model.tabs) {
    // Display last opened tabs by default
    results = ext.model.tabs
      .map((el) => ({ ...el }))
      .sort((a, b) => {
        return a.lastVisitSecondsAgo - b.lastVisitSecondsAgo
      })
  } else if (ext.model.searchMode === 'bookmarks' && ext.model.bookmarks) {
    // Display all bookmarks by default
    results = ext.model.bookmarks.map((el) => ({ ...el }))
  } else {
    // Default: Find bookmarks that match current page URL
    let activeTab
    try {
      const [tab] = await getBrowserTabs({ active: true, currentWindow: true })
      activeTab = tab
      if (tab?.url) {
        const currentUrl = cleanUpUrl(tab.url)
        const matchingBookmarks = ext.model.bookmarks.filter((el) => el.url === currentUrl)
        if (matchingBookmarks.length > 0) {
          results.push(...matchingBookmarks.map((el) => ({ ...el })))
        } else if (isQuickBookmarkEnabled() && isBookmarkableUrl(tab.url)) {
          results.push(createQuickBookmarkEntry(tab))
        }
      }
    } catch (err) {
      console.warn('Could not get current tab for default entries:', err)
    }

    // Always add recently visited tabs when option is enabled and no search term
    if (ext.model.tabs && ext.opts.maxRecentTabsToShow > 0) {
      const recentTabs = ext.model.tabs
        .filter((tab) => {
          // Exclude the currently active tab from recent tabs
          const isCurrentTab = activeTab && activeTab.id !== undefined && tab.originalId === activeTab.id
          return tab?.url && !isCurrentTab && isBookmarkableUrl(tab.url)
        })
        .map((el) => ({ ...el }))
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

/**
 * Build a synthetic default result for creating a bookmark from the active tab.
 *
 * @param {Object} tab - Active browser tab.
 * @returns {Object} Search result entry.
 */
function createQuickBookmarkEntry(tab) {
  return {
    type: 'bookmarkCreate',
    title: 'Bookmark current page',
    pageTitle: tab.title || '',
    originalUrl: tab.url,
    url: cleanUpUrl(tab.url),
    favIconUrl: tab.favIconUrl,
  }
}

/**
 * Determine whether the active tab is useful as a bookmark target.
 *
 * @param {string} url - Active tab URL.
 * @returns {boolean} Whether to show the quick-bookmark action.
 */
function isBookmarkableUrl(url) {
  const trimmedUrl = typeof url === 'string' ? url.trim() : ''
  if (!trimmedUrl) {
    return false
  }

  const normalizedUrl = trimmedUrl.toLowerCase()
  return !UNBOOKMARKABLE_URL_PREFIXES.some((prefix) => normalizedUrl.startsWith(prefix))
}

/**
 * Check whether quick bookmark creation is configured.
 *
 * @returns {boolean} Whether quick-bookmark default results are enabled.
 */
function isQuickBookmarkEnabled() {
  return typeof ext.opts.quickBookmarkCurrentTab === 'string' && ext.opts.quickBookmarkCurrentTab.trim().length > 0
}
