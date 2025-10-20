/**
 * @file Centralized cache invalidation utilities for search and taxonomy indexes.
 *
 * Responsibilities:
 * - Provide unified cache reset functions to avoid duplication across edit/delete workflows.
 * - Keep fuzzy/precise search state and folder indexes synchronized when bookmarks change.
 * - Support partial resets (e.g., bookmarks-only) or full resets across all search modes.
 */

import { resetFuzzySearchState } from '../search/fuzzySearch.js'
import { resetSimpleSearchState } from '../search/simpleSearch.js'
import { resetUniqueFoldersCache } from '../search/taxonomySearch.js'

/**
 * Invalidate all bookmark-related caches.
 *
 * Call this after updating or deleting bookmarks to ensure search results
 * reflect the current state. Resets fuzzy search, precise search, and folder
 * taxonomy caches for the bookmarks dataset.
 */
export function invalidateBookmarkCaches() {
  resetFuzzySearchState('bookmarks')
  resetSimpleSearchState('bookmarks')
  resetUniqueFoldersCache()
}
