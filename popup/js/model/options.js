/**
 * @file Centralizes extension configuration and user overrides.
 *
 * Responsibilities:
 * - Define default options for all extension features
 * - Merge user options with defaults to get effective configuration
 * - Load/save user options to browser storage (with sync/local fallback)
 * - Validate user options to prevent invalid configurations
 *
 * Configuration Sources (in priority order):
 * 1. User options from browser storage (sync storage or localStorage)
 * 2. Default options (built-in sensible defaults)
 *
 * User options can be customized via YAML/JSON in the settings page.
 * All options are optional - unspecified options fall back to defaults.
 *
 * @see https://github.com/Fannon/search-bookmarks-history-and-tabs#user-configuration
 * @see /popup/json/options.schema.json for documentation and validation details.
 */

import { defaultOptions } from './optionsDefaults.js'
import { getEffectiveOptions, getUserOptions, setUserOptions } from './optionsStorage.js'

export { defaultOptions, getEffectiveOptions, getUserOptions, setUserOptions }

/**
 * Normalize and clean up user options.
 * - Validates that options are a valid JSON-serializable object
 * - Warns about and removes unknown option keys
 *
 * @param {Object} userOptions - Options object to normalize.
 * @returns {Object} Normalized options with unknown keys removed.
 */
export function normalizeUserOptions(userOptions) {
  if (userOptions === undefined || userOptions === null) {
    return {}
  }

  if (typeof userOptions !== 'object' || Array.isArray(userOptions)) {
    throw new Error('User options must be a valid YAML / JSON object')
  }

  try {
    JSON.stringify(userOptions)
  } catch (err) {
    throw new Error(`User options cannot be parsed into JSON: ${err.message}`)
  }

  // Warn about and remove unknown options
  const validKeys = new Set(Object.keys(defaultOptions))
  const cleanedOptions = {}

  for (const key of Object.keys(userOptions)) {
    if (validKeys.has(key)) {
      cleanedOptions[key] = userOptions[key]
    } else {
      console.warn(`Unknown user option: "${key}". It will be ignored and removed.`)
    }
  }

  return cleanedOptions
}

/**
 * @deprecated Use normalizeUserOptions instead
 */
export const validateUserOptions = normalizeUserOptions
