/**
 * @file Defines the shared extension context consumed by all popup entry points.
 *
 * Responsibilities:
 * - Centralize options, search models, DOM caches, taxonomy indexes, and browser API access in a single namespace.
 * - Provide consistent state whenever a popup window opens, avoiding redundant fetches or divergent global variables.
 * - Track lifecycle flags (initialized, returnHash) and caches (search results) to coordinate navigation across pages.
 */

import { browserApi } from './browserApi.js'

/**
 * Creates the base extension context shared across popup entry points
 *
 * The extension context (ext object) serves as the global state container
 * holding all application data, options, DOM references, and browser APIs.
 * It's initialized once per popup and shared across all modules.
 *
 * Properties:
 * - opts: Effective user options (merged with defaults)
 * - model: Data models including search results and selections
 * - index: Pre-computed indexes for taxonomy (tags, folders)
 * - dom: Cached DOM element references for performance
 * - browserApi: Browser-specific APIs (chrome, browser)
 * - searchCache: Map for caching search results by (term, strategy, mode)
 * - initialized: Flag indicating completion of async initialization
 * - returnHash: For hash-based navigation (used in bookmark editor)
 *
 * @returns {Object} Extension namespace object
 */
export function createExtensionContext() {
  return {
    /** Options */
    opts: {},
    /** Model / data */
    model: {
      /** Currently selected result item index */
      currentItem: 0,
      /** Current search results array */
      result: [],
      /** Tracks pending debounced search state */
      searchDebounce: {
        timeoutId: null,
        isPending: false,
      },
      /** Flush handler assigned during initialization */
      flushPendingSearch: null,
    },
    /** Search indexes (e.g., taxonomy for tags and folders) */
    index: {
      taxonomy: {},
    },
    /** Commonly used DOM Elements (cached references) */
    dom: {},
    /** The browser / extension API (chrome or firefox) */
    browserApi,
    /** Whether the extension entry point finished initialization */
    initialized: false,
  }
}
