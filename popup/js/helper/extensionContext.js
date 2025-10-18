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
