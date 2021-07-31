import { mergeDeep } from "./utils.js";

//////////////////////////////////////////
// OPTIONS                              //
//////////////////////////////////////////

/**
 * The default options.
 * They can be customized via user options that are stored on the chrome.storage.sync API
 */
export const defaultOptions = {
  general: {
    /** Extract tags from title and display it as a badge with different search prio */
    tags: true,
    /** Highlight search matches in result */
    highlight: true,
    /** Display last visit */
    lastVisit: true,
    /** Display visit count */
    visitCounter: false,
    /** Display search result score */
    displayScore: true,
  },
  search: {
    /** Max results to render. Reduce for better performance */
    maxResults: 256,
    /** Min characters that need to match */
    minMatchCharLength: 2,
    /** Fuzzy search threshold (increase to increase fuzziness) */
    threshold: 0.4,
    /** Filters out all search results below this minimum score */
    minScore: 30,
    /** Weight for a title match. From 0-1. */
    titleWeight: 1,
    /** Weight for a tag match. From 0-1. */
    tagWeight: 0.7,
    /** Weight for an url match. From 0-1. */
    urlWeight: 0.55,
    /** Weight for a folder match. From 0-1. */
    folderWeight: 0.2,
    /** Base score for bookmark results */
    bookmarkBaseScore: 100,
    /** Base score for tab results */
    tabBaseScore: 90,
    /** Base score for history results */
    historyBaseScore: 50,
    /** Additional score points per visit within history hoursAgo */
    visitedBonusScore: 2,
    /** Maximum score points for visitied bonus */
    maxVisitedBonusScore: 40,
    /** 
     * Additional score points if title, url and tag starts exactly with search text.
     * The points can be added multiple times, if more than one has a "starts with" match.
     */
    startsWithBonusScore: 10,
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
    /** How many hours ago the history should be fetched */
    hoursAgo: 24,
    /** How many history items should be fetched at most */
    maxItems: 1024,
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
 */
export async function getEffectiveOptions() {
  const userOptions = await getUserOptions()
  return mergeDeep(defaultOptions, userOptions)
}

