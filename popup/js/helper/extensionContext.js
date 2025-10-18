/**
 * @file Defines the shared extension context consumed by all popup entry points.
 * Centralizes options, models, DOM caches, and lifecycle flags in a single namespace.
 */

import { browserApi } from './browserApi.js'

/**
 * Create the base extension context shared across popup entry points.
 * @returns {Object}
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
