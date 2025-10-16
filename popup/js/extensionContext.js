import { browserApi } from './helper/browserApi.js'

/**
 * Creates the base extension context shared across popup entry points.
 * @returns {import('./initSearch.js').ext} Extension namespace object.
 */
export function createExtensionContext() {
  return {
    /** Options */
    opts: {},
    /** Model / data */
    model: {
      /** Currently selected result item */
      currentItem: 0,
      /** Current search results */
      result: [],
    },
    /** Search indexes */
    index: {
      taxonomy: {},
    },
    /** Commonly used DOM Elements */
    dom: {},
    /** The browser / extension API */
    browserApi,
    /** Whether the extension entry point finished initialization */
    initialized: false,
  }
}
