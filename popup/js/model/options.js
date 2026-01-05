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

import { printError } from '../view/errorView.js'

/**
 * The default options.
 *
 * See /popup/json/options.schema.json for documentation and validation details.
 * They can be selectively overwritten and customized via user options.
 */
export const defaultOptions = {
  //////////////////////////////////////////
  // GENERAL OPTIONS                      //
  //////////////////////////////////////////

  /** Enable detailed logging in the browser console */
  debug: false,

  //////////////////////////////////////////
  // SEARCH OPTIONS                       //
  //////////////////////////////////////////

  /**
   * Search approach to use. Choose between:
   * - 'precise': Simple search that only finds precise matches (fastest)
   * - 'fuzzy': Fuzzy search that finds approximate matches (uses uFuzzy)
   */
  searchStrategy: 'precise',
  /** Max search results. Reduce for better performance. */
  searchMaxResults: 24,
  /** Fuzzy search threshold (0-1). 0 = no fuzzyness, 1 = full fuzzyness */
  searchFuzzyness: 0.6,
  /** Debounce time in milliseconds before search executes */
  searchDebounceMs: 100,

  //////////////////////////////////////////
  // COLORS AND STYLE                     //
  //////////////////////////////////////////

  /** Color for bookmark results, expressed as CSS color */
  bookmarkColor: '#3c8d8d',
  /** Color for tab results */
  tabColor: '#b89aff',
  /** Color for history results */
  historyColor: '#9ece2f',
  /** Color for search engine suggestions */
  searchColor: '#e1a535',
  /** Color for custom search engine results */
  customSearchColor: '#ce5c2f',
  /** Color for direct URL navigation */
  directColor: '#7799CE',

  //////////////////////////////////////////
  // SOURCES                              //
  //////////////////////////////////////////

  /** Enable tab indexing */
  enableTabs: true,
  /** Enable bookmark indexing */
  enableBookmarks: true,
  /** Enable history indexing */
  enableHistory: true,
  /** Enable search engine suggestions */
  enableSearchEngines: true,
  /** Show helpful tips when popup opens */
  enableHelp: true,
  /** Detect URL-shaped terms and offer direct navigation */
  enableDirectUrl: true,

  //////////////////////////////////////////
  // DISPLAY OPTIONS                      //
  //////////////////////////////////////////

  /**
   * Extract tags from bookmark titles and display them as clickable badges.
   * Tags are text prefixed with `#` (e.g., `Bookmark Title #work #dev`).
   */
  displayTags: true,
  /** Display bookmark folder names as clickable badges */
  displayFolderName: true,
  /** Highlight matching text in titles and URLs */
  displaySearchMatchHighlight: true,
  /** Display tab group name as clickable badges */
  displayTabGroup: true,
  /** Display last visit time ago */
  displayLastVisit: true,
  /** Display visit counter from browsing history */
  displayVisitCounter: false,
  /** Display date bookmark was added */
  displayDateAdded: false,
  /** Display numeric relevance score */
  displayScore: true,
  /** Display website favicons next to results (Chrome only for bookmarks/history) */
  displayFavicon: true,

  //////////////////////////////////////////
  // BOOKMARKS OPTIONS                    //
  //////////////////////////////////////////

  /** Bookmark folder paths to exclude from indexing */
  bookmarksIgnoreFolderList: [],
  /** Detect and mark duplicate bookmarks (same URL) */
  detectDuplicateBookmarks: false,

  //////////////////////////////////////////
  // TABS OPTIONS                         //
  //////////////////////////////////////////

  /** Only consider tabs from the current browser window */
  tabsOnlyCurrentWindow: false,
  /** Number of recently visited tabs to show when the popup opens. Set to 0 to disable. */
  maxRecentTabsToShow: 8,

  //////////////////////////////////////////
  // HISTORY OPTIONS                      //
  //////////////////////////////////////////

  /** How many days ago the browser history should be fetched */
  historyDaysAgo: 14,
  /** Maximum number of history items to retrieve */
  historyMaxItems: 1024,
  /** URL fragments to exclude from history indexing */
  historyIgnoreList: ['extension://'],

  //////////////////////////////////////////
  // SEARCH ENGINES                       //
  //////////////////////////////////////////

  /** Built-in search engines shown as fallback actions */
  searchEngineChoices: [
    {
      name: 'Google',
      urlPrefix: 'https://www.google.com/search?q=$s',
    },
  ],
  /** Custom search engines triggered via aliases */
  customSearchEngines: [
    {
      alias: ['g', 'google'],
      name: 'Google',
      urlPrefix: 'https://www.google.com/search?q=$s',
      blank: 'https://www.google.com',
    },
    {
      alias: ['d', 'dict'],
      name: 'dict.cc',
      urlPrefix: 'https://www.dict.cc/?s=$s',
      blank: 'https://www.dict.cc',
    },
  ],

  //////////////////////////////////////////
  // SCORE CALCULATION OPTIONS            //
  //////////////////////////////////////////

  // Result type base scores
  scoreBookmarkBase: 100,
  scoreTabBase: 70,
  scoreHistoryBase: 45,
  scoreSearchEngineBase: 30,
  scoreCustomSearchEngineBase: 400,
  scoreDirectUrlScore: 500,

  // Field weights for score calculation
  scoreTagWeight: 0.7,
  scoreGroupWeight: 0.7,
  scoreUrlWeight: 0.6,
  scoreFolderWeight: 0.5,

  // Bonus scores
  scoreCustomBonusScore: true,
  scoreExactIncludesBonus: 5,
  scoreExactStartsWithBonus: 10,
  scoreExactEqualsBonus: 20,
  scoreExactTagMatchBonus: 15,
  scoreExactGroupMatchBonus: 15,
  scoreExactFolderMatchBonus: 10,
  scoreExactPhraseTitleBonus: 8,
  scoreExactPhraseUrlBonus: 5,
  scoreVisitedBonusScore: 0.5,
  scoreVisitedBonusScoreMaximum: 20,
  scoreRecentBonusScoreMaximum: 20,
  scoreBookmarkOpenTabBonus: 10,

  //////////////////////////////////////////
  // POWER USER OPTIONS                   //
  //////////////////////////////////////////

  /** Advanced configuration for the uFuzzy search library */
  uFuzzyOptions: {},
}

export const emptyOptions = {
  searchStrategy: defaultOptions.searchStrategy,
}

/**
 * Writes user settings to the sync storage, falls back to local storage.
 *
 * NOTE: This function does NOT validate options against the schema.
 * Validation should be done separately (e.g., in editOptionsView.js) before
 * calling this function when users edit raw configuration.
 * Internal code changes (like search strategy toggle) can call this directly
 * since the values are known to be valid.
 *
 * @see https://developer.chrome.com/docs/extensions/reference/storage/
 *
 * @param {Object} [userOptions={}] - User overrides to persist.
 * @returns {Promise<void>}
 */
export async function setUserOptions(userOptions = {}) {
  const normalizedOptions = normalizeUserOptions(userOptions)

  return new Promise((resolve, reject) => {
    if (ext.browserApi.storage?.sync) {
      ext.browserApi.storage.sync.set({ userOptions: normalizedOptions }, () => {
        if (ext.browserApi.runtime.lastError) {
          return reject(ext.browserApi.runtime.lastError)
        }
        return resolve()
      })
    } else {
      console.warn('No storage API found. Falling back to local Web Storage')
      window.localStorage.setItem('userOptions', JSON.stringify(normalizedOptions))
      return resolve()
    }
  })
}

/**
 * Get user options, fall back to default options
 *
 * @returns {Promise<Object>} Stored user overrides (or defaults).
 */
export async function getUserOptions() {
  return new Promise((resolve, reject) => {
    try {
      if (ext.browserApi.storage?.sync) {
        ext.browserApi.storage.sync.get(['userOptions'], (result) => {
          if (ext.browserApi.runtime.lastError) {
            return reject(ext.browserApi.runtime.lastError)
          }
          const userOptions = result.userOptions || emptyOptions
          return resolve(userOptions)
        })
      } else {
        console.warn('No storage API found. Falling back to local Web Storage')
        const userOptionsString = window.localStorage.getItem('userOptions')
        const userOptions = userOptionsString ? JSON.parse(userOptionsString) : emptyOptions
        return resolve(userOptions)
      }
    } catch (err) {
      return reject(err)
    }
  })
}

/**
 * Gets the actual effective options based on the default options
 * and the overrides of the user options
 *
 * @returns {Promise<Object>} Effective options object.
 */
export async function getEffectiveOptions() {
  try {
    const userOptions = await getUserOptions()
    const normalizedOptions = normalizeUserOptions(userOptions)
    return {
      ...defaultOptions,
      ...normalizedOptions,
    }
  } catch (err) {
    printError(err, 'Could not get valid user options, falling back to defaults.')
    return defaultOptions
  }
}

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
