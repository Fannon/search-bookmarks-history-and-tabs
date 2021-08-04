import { mergeDeep } from "./utils.js";

/**
 * The default options
 * 
 * They can be selectively overwritten and customized via user options
 * @see https://github.com/Fannon/search-tabs-bookmarks-and-history#user-configuration
 */
export const defaultOptions = {

  general: {
    /** Extract tags from title and display it as a badge with different search prio */
    tags: true,
    /** Highlight search matches in results */
    highlight: true,
    /** Display last visit */
    lastVisit: true,
    /** Display visit count */
    visitCounter: false,
    /** Display search result score */
    score: false,
    /** 
     * As a fallback, use search machines to find results
     * 
     * For each entry here, one result will be created - in the order they are defined.
     * The URLs need to include the search querystring (see examples).
     *
     * To disable this feature, set `searchEngines` to false or [] (emtpy array).
     */
    searchEngines: [
      {
        name: "Google",
        urlPrefix: "https://www.google.com/search?q=",
      },
      {
        name: "Bing",
        urlPrefix: "https://www.bing.com/search?q=",
      },
      {
        name: "DuckDuckGo",
        urlPrefix: "https://duckduckgo.com/?q=",
      },
      {
        name: "dict.cc",
        urlPrefix: "https://www.dict.cc/?s="
      }
    ],
  },

  search: {
    /** 
     * Search library to use.
     * * 'fuse.js' is the default choice and allows for fuzzy, but slower search
     * * 'flexsearch' is faster and only allows for precise search 
    */
    library: 'fuse.js',
    /** Max search results. Reduce for better performance */
    maxResults: 128,
    /** Min search string characters to have a match */
    minMatchCharLength: 2,
    /** 
     * Fuzzy search threshold (0 - 1) 
     * 0 is no fuzzyness, 1 is full fuzzyness
     */
    fuzzyness: 0.4,
  },

  tabs: {
    /** Whether to index and search for open tabs */
    enabled: true,
  },

  bookmarks: {
    /** Whether to index and search for bookmarks */
    enabled: true,
  },

  history: {
    /** 
     * Whether to index and search for browsing history 
     * Please note that the history API tends to be slow, 
     * so be careful about how many items you load.
     */
    enabled: true,
    /** How many days ago the history should be fetched */
    daysAgo: 3,
    /** How many history items should be fetched at most */
    maxItems: 1024,
  },

  score: {

    /** Filter out all search results below this minimum score */
    minScore: 30,

    // BASE SCORES
    // Depending on the type of result, they start with a base score

    /** Base score for bookmark results */
    bookmarkBaseScore: 100,
    /** Base score for tab results */
    tabBaseScore: 90,
    /** Base score for history results */
    historyBaseScore: 50,
    /** Additional score points per visit within history daysAgo */

    // MULTIPLICATORS
    // Depending on where the search match was found, the multiplicators
    // define the "weight" of the find.

    /** Multiplicator for a title match*/
    titleMultiplicator: 1,
    /** Multiplicator for a tag match*/
    tagMultiplicator: 0.7,
    /** Multiplicator for an url match*/
    urlMultiplicator: 0.55,
    /** Multiplicator for a folder match*/
    folderMultiplicator: 0.2,

    // BONUS SCORES
    // If certain conditions apply, extra score points can be added

    /** 
     * Additional score points if title or url starts exactly with the search text.
     */
    exactStartsWithBonus: 20,
    /**
     * If we don't have an excact starts "with match", bonus points for an excact "includes" match
     */
    exactIncludesBonus: 10,

    /**
     * Additinal points for an exact match of a search term tag (including #)
     */
    exactTagMatchBonus: 10,

    /**
     * Additinal points for an exact match of a search term folder name (including ~)
     */
    exactFolderMatchBonus: 5,

    /** 
     * Adds score points for every site visit according to browsing history 
     * Please note that this is not only within `history.daysAgo`, but you whole history.
     */
    visitedBonusScore: 2,
    /** Maximum score points for visitied bonus */
    visitedBonusScoreMaximum: 30,
  },
}

/**
 * This is the default empty user options
 */
export const emptyUserOptions = {
  general: {},
  search: {},
  tabs: {},
  bookmarks: {},
  history: {},
  score: {},
}

/**
 * Writes user settings to the google chrome sync storage
 * 
 * @see https://developer.chrome.com/docs/extensions/reference/storage/
 */
export function setUserOptions(userOptions) {
  return new Promise((resolve, reject) => {
    if (chrome && chrome.storage) {
      chrome.storage.sync.set({ userOptions: userOptions }, () => {
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }
        return resolve()
      });
    }
  })
}

/**
 * Get user options. 
 * If none are stored yet, this will return the default empty options
 * 
 * TODO: Add fallback to window.localStorage
 */
export async function getUserOptions() {
  return new Promise((resolve, reject) => {
    if (chrome && chrome.storage) {
      chrome.storage.sync.get(['userOptions'], (result,) => {
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }
        return resolve(result.userOptions || emptyUserOptions)
      });
    } else {
      console.warn('No chrome storage API found. Returning empty user options')
      return resolve(emptyUserOptions)
    }
  })
}


/**
 * Gets the actual effective options based on the default options
 * and the overrides of the user options
 * 
 * TODO: Add fallback to window.localStorage
 */
export async function getEffectiveOptions() {
  const userOptions = await getUserOptions()
  return mergeDeep(defaultOptions, userOptions)
}

