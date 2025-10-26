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
 * @see https://github.com/Fannon/search-tabs-bookmarks-and-history#user-configuration
 */

import { printError } from '../view/errorView.js'

/**
 * The default options
 *
 * They can be selectively overwritten and customized via user options
 * @see https://github.com/Fannon/search-tabs-bookmarks-and-history#user-configuration
 */
export const defaultOptions = {
  //////////////////////////////////////////
  // SEARCH OPTIONS                       //
  //////////////////////////////////////////

  /**
   * Search approach to use. Choose between:
   *
   * * 'precise': Simple search approach that will only find precise matches.
   *              It provides best init performance and provides good search performance.
   *              The 'fuzzyness' option will be ignored
   *
   * * 'fuzzy':   Search approach that implements a fuzzy (approximate) search.
   *              This search approach will find more results, even if there are no perfect matches.
   *              It has a moderate impact on init performance, and is slower when searching.
   *              It supports all options.
   *              Uses https://github.com/leeoniya/uFuzzy
   */
  searchStrategy: 'precise', // 'precise' or 'fuzzy'
  /**
   * Max search results. Reduce for better performance.
   * Does not apply for tag and folder search
   */
  searchMaxResults: 32,
  /**
   * Minimum string characters of the search term to consider a match
   */
  searchMinMatchCharLength: 1,
  /**
   * Fuzzy search threshold (0 - 1)
   * 0 is no fuzzyness, 1 is full fuzzyness
   *
   * This applies only to search approach 'fuzzy'.
   * For precise this is always 0 (no fuzzyness)
   */
  searchFuzzyness: 0.6,
  //////////////////////////////////////////
  // COLORS AND STYLE                     //
  //////////////////////////////////////////

  /**
   * Width of the left color marker in search results in pixels
   */
  colorStripeWidth: 5,
  /**
   * Color for bookmark results, expressed as CSS color
   */
  bookmarkColor: '#3c8d8d',
  /**
   * Color for tab results, expressed as CSS color
   */
  tabColor: '#b89aff',
  /**
   * Color for history results, expressed as CSS color
   */
  historyColor: '#9ece2f',
  /**
   * Color for search results, expressed as CSS color
   */
  searchColor: '#e1a535',
  /**
   * Color for custom search results, expressed as CSS color
   */
  customSearchColor: '#ce5c2f',
  /**
   * Color for direct URL results, expressed as CSS color
   */
  directColor: '#7799CE',

  //////////////////////////////////////////
  // SEARCH SOURCES                       //
  //////////////////////////////////////////

  /**
   * Whether to index and search for open browser tabs
   */
  enableTabs: true,
  /**
   * Whether to index and search for bookmarks
   */
  enableBookmarks: true,
  /**
   * Whether to index and search for browsing history
   * Please note that the history API tends to be slow,
   * so be careful about how many items you load.
   */
  enableHistory: true,
  /**
   * Enable or disable search engine links in results
   * Search engines can be a useful fallback mechanism to search externally for the term
   */
  enableSearchEngines: true,
  /**
   * Enable help and tips on startup
   */
  enableHelp: true,
  /**
   * Whether to treat URL like terms as directly navigable.
   */
  enableDirectUrl: true,

  //////////////////////////////////////////
  // DISPLAY OPTIONS                      //
  //////////////////////////////////////////

  /**
   * Extract tags from title and display it as a badge with different search priority
   * Disabling this will also disable the tag overview and the tag search mode.
   */
  displayTags: true,
  /**
   * Display and search the folder names of bookmarks.
   * Disabling this will also disable the folder overview and the folder search mode.
   */
  displayFolderName: true,
  /**
   * Highlight search matches in results.
   * Reduces rendering performance a little.
   */
  displaySearchMatchHighlight: true,
  /**
   * Display last visit (time ago)
   */
  displayLastVisit: true,
  /**
   * Display how many times a result was visited (by history)
   */
  displayVisitCounter: false,
  /**
   * Display date when a bookmark was added
   */
  displayDateAdded: false,
  /**
   * Display result score.
   * The score indicates the relevance of the result and defines the order of results.
   */
  displayScore: true,

  //////////////////////////////////////////
  // BOOKMARKS OPTIONS                    //
  //////////////////////////////////////////

  /**
   * Ignores all bookmarks within the folders listed here, including their subfolders.
   */
  bookmarksIgnoreFolderList: [],

  //////////////////////////////////////////
  // TABS OPTIONS                         //
  //////////////////////////////////////////

  /**
   * If true, only the current browser window is considered for tab indexing and switching
   */
  tabsOnlyCurrentWindow: false,
  /**
   * Number of recent tabs to show when popup is opened without search term. Set to 0 to disable.
   * Limiting this improves performance for users with many open tabs
   */
  maxRecentTabsToShow: 16,

  //////////////////////////////////////////
  // HISTORY OPTIONS                      //
  //////////////////////////////////////////

  /**
   * How many days ago the browser history should be fetched
   */
  historyDaysAgo: 14,
  /**
   * How many history items should be fetched at most
   * Be careful, as too many items have negative impact on startup and search performance
   */
  historyMaxItems: 1024,
  /**
   * All history items that where the URL includes the given strings will be skipped
   */
  historyIgnoreList: ['extension://'],

  //////////////////////////////////////////
  // SEARCH ENGINES OPTIONS               //
  //////////////////////////////////////////

  /**
   * Search Engine "Providers" which are used to pass on the search term via URL
   *
   * For each entry here, one result will be created - in the order they are defined.
   * The URLs need to include the search querystring (see examples).
   *
   * If an '$s' is part of the urlPrefix, it will be replaced with the search term.
   * Otherwise, the search term is appended to the urlPrefix.
   */
  searchEngineChoices: [
    {
      name: 'Google',
      urlPrefix: 'https://www.google.com/search?q=$s',
    },
  ],

  /**
   * Allows to define custom search engines with their own custom alias
   * To trigger a search, type in the alias plus space: `<alias> ` to begin the search
   * The alias can be one string or an array of strings
   *
   * If an '$s' is part of the urlPrefix, it will be replaced with the search term.
   * Otherwise, the search term is appended to the urlPrefix.
   *
   * Optionally, a "blank" can be given, which is the URL chosen when there is no search string.
   * With this, they act like a "high-priority" custom bookmark.
   */
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

  /**
   * Filter out all search results below this minimum score
   */
  scoreMinScore: 30,

  // RESULT TYPE BASE SCORES
  // Depending on the type of result, they start with a base score
  // Please make sure that this is not below the minScore :)
  /**
   * Base score for bookmark results
   */
  scoreBookmarkBase: 100,
  /**
   * Base score for tab results
   */
  scoreTabBase: 70,
  /**
   * Base score for history results
   */
  scoreHistoryBase: 45,
  /**
   * Base score for search engine choices
   */
  scoreSearchEngineBase: 30,
  /**
   * Base score for custom search engine choices
   * This is set very high to ensure that it's the topmost entry
   */
  scoreCustomSearchEngineBase: 400,
  /**
   * Base score for a direct URL being typed in
   */
  scoreDirectUrlScore: 500,

  // FIELD WEIGHTS
  // Depending on in which field the search match was found,
  // the match gets a multiplier applied on how important the match is.
  /** Weight for a title match*/
  scoreTitleWeight: 1,
  /** Weight for a tag match*/
  scoreTagWeight: 0.7,
  /** Weight for an url match*/
  scoreUrlWeight: 0.6,
  /** Weight for a folder match*/
  scoreFolderWeight: 0.5,

  // BONUS SCORES
  // If certain conditions apply, extra score points can be added
  /**
   * If enabled, bookmarks can add custom bonus scores by putting it in the title
   * HowTo: Add a ` +<score>` (space, plus sign, whole number) in the title before tags.
   * Do not add bonus scores more than once in a single bookmark title.
   * E.g: `Bookmark Title +20` or `Another Bookmark +10 #tag1 #tag2`
   * */
  scoreCustomBonusScore: true,
  /**
   * For each exact "includes" match we add some bonus points
   */
  scoreExactIncludesBonus: 5,
  /**
   * Maximum number of substring bonuses per result (prevents noisy documents from stacking).
   */
  scoreExactIncludesMaxBonuses: 3,
  /**
   * The minimum characters a search term needs to have to consider a exact includes match
   */
  scoreExactIncludesBonusMinChars: 3,
  /**
   * Additional score points if title or url starts exactly with the search text.
   * This comes on top of an include bonus.
   */
  scoreExactStartsWithBonus: 10,
  /**
   * Additional score points if title matches exactly with the search text.
   * This comes on top of an include and starts with bonus.
   */
  scoreExactEqualsBonus: 20,
  /**
   * Additional points for an exact match of a search term tag
   */
  scoreExactTagMatchBonus: 15,
  /**
   * Additional points for an exact match of a search term folder name
   */
  scoreExactFolderMatchBonus: 10,
  /**
   * Bonus if the full search phrase appears in the title (multi-word searches only).
   * This rewards results where ALL search terms appear together as a phrase, not just individually.
   * Example: searching "react hooks" gives this bonus if title contains "react hooks" exactly.
   * This is in addition to individual word bonuses from scoreExactIncludesBonus.
   * Single-word searches do not receive this bonus.
   */
  scoreExactPhraseTitleBonus: 8,
  /**
   * Bonus if the full search phrase appears in the URL (multi-word searches only, hyphen-normalized).
   * URLs typically use hyphens instead of spaces, so "react hooks" matches "react-hooks" in URLs.
   * This rewards results where the search phrase appears as a cohesive unit in the URL path.
   * Example: searching "user profile" matches URLs containing "user-profile".
   * This is in addition to individual word bonuses from scoreExactIncludesBonus.
   * Single-word searches do not receive this bonus.
   */
  scoreExactPhraseUrlBonus: 5,
  /**
   * Adds score points for every site visit according to browsing history
   * Please note that only history items within `history.daysAgo` can be considered,
   * however the visited counter itself considers your complete history.
   */
  scoreVisitedBonusScore: 0.5,
  /**
   * Maximum score points for visited bonus
   */
  scoreVisitedBonusScoreMaximum: 20,
  /**
   * Adds score points when item has been visited recently.
   * If it has been visited just now, score is maximum
   * If it has been visited at the end of `historyDaysAgo`, score is 0
   */
  scoreRecentBonusScoreMaximum: 20,
  /**
   * Adds bonus points when a bookmark is also currently open as a browser tab.
   * Helps prioritize results that already exist in your session to prevent duplicate openings.
   */
  scoreBookmarkOpenTabBonus: 10,

  //////////////////////////////////////////
  // POWER USER OPTIONS                   //
  //////////////////////////////////////////

  // Those are only meant for power users who know what they're doing
  // And those options may also not be long-time stable

  /**
   * If the extension detects that the title is just the URL of the link,
   * it gets shortened so the result entries are not swamped by long URL patterns
   */
  titleLengthRestrictionForUrls: 80,

  /**
   * Customized options for the fuzzy search library uFuzzy ('@leeoniya/ufuzzy')
   * @see https://github.com/leeoniya/uFuzzy/blob/main/src/uFuzzy.js#L9
   */
  uFuzzyOptions: {},
}

export const emptyOptions = {
  searchStrategy: defaultOptions.searchStrategy,
}

/**
 * Writes user settings to the sync storage, falls back to local storage
 *
 * @see https://developer.chrome.com/docs/extensions/reference/storage/
 *
 * @param {Object} [userOptions={}] - User overrides to persist.
 * @returns {Promise<void>}
 */
export async function setUserOptions(userOptions = {}) {
  return new Promise((resolve, reject) => {
    try {
      validateUserOptions(userOptions)
    } catch (err) {
      printError(err, 'Could not save user options.')
      return reject(err)
    }

    if (ext.browserApi.storage && ext.browserApi.storage.sync) {
      ext.browserApi.storage.sync.set({ userOptions: userOptions }, () => {
        if (ext.browserApi.runtime.lastError) {
          return reject(ext.browserApi.runtime.lastError)
        }
        return resolve()
      })
    } else {
      console.warn('No storage API found. Falling back to local Web Storage')
      window.localStorage.setItem('userOptions', JSON.stringify(userOptions))
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
      if (ext.browserApi.storage && ext.browserApi.storage.sync) {
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
    validateUserOptions(userOptions)
    return {
      ...defaultOptions,
      ...userOptions,
    }
  } catch (err) {
    printError(err, 'Could not get valid user options, falling back to defaults.')
    return defaultOptions
  }
}

/**
 * Ensure user options are valid JSON-serialisable objects.
 *
 * @param {Object} userOptions - Options object to validate.
 */
export function validateUserOptions(userOptions) {
  if (userOptions) {
    if (typeof userOptions !== 'object') {
      throw new Error('User options must be a valid YAML / JSON object')
    }
    try {
      JSON.stringify(userOptions)
    } catch (err) {
      throw new Error(`User options cannot be parsed into JSON: ${err.message}`)
    }
  }
}
