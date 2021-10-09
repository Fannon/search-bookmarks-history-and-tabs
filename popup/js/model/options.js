import { mergeDeep } from '../helper/utils.js'

/**
 * The default options
 *
 * They can be selectively overwritten and customized via user options
 * @see https://github.com/Fannon/search-tabs-bookmarks-and-history#user-configuration
 */
export const defaultOptions = {
  general: {
    /**
     * Extract tags from title and display it as a badge with different search priority
     * Disabling this will also disable the tag overview and the tag search mode.
     */
    tags: true,
    /**
     * Display and search the folder names of bookmarks.
     * Disabling this will also disable the folder overview and the folder search mode.
     */
    folderName: true,
    /**
     * Highlight search matches in results.
     * Reduces rendering performance a little.
     */
    highlight: true,
    /** Display last visit */
    lastVisit: true,
    /** Display visit count */
    visitCounter: false,
    /** Display added date for bookmarks */
    dateAdded: false,
    /** Display search result score */
    score: true,
  },

  search: {
    /**
     * Search approach to use. Choose between:
     *
     * * 'precise' : Alternative search approach that is more precise.
     *               It may be slower to index / start up, but faster for searching.
     *               The 'fuzzyness' option will be ignored
     *               Uses the https://github.com/nextapps-de/flexsearch library
     *
     * * 'fuzzy'   : Default choice that allows for fuzzy (approximate) search.
     *               It is faster to index / start up, but may be slower when searching.
     *               It supports all options.
     *               Uses the https://fusejs.io/ library
     */
    approach: 'precise', // 'precise' or 'fuzzy'

    /**
     * Max search results. Reduce for better performance.
     * Does not apply for tag and folder search
     */
    maxResults: 50,

    /** Min string characters of the search term to consider a match */
    minMatchCharLength: 1,

    /**
     * Fuzzy search threshold (0 - 1)
     * 0 is no fuzzyness, 1 is full fuzzyness
     *
     * This applies only to search approach 'fuzzy'.
     * For precise this is always 0 (no fuzzyness)
     */
    fuzzyness: 0.4,

    /**
     * How search matches are considered
     * 'startsWith' is only considering a match if the search term starts with the term
     * 'includes' also considers matches where the term is included anywhere.
     *
     * Setting this to 'includes' will drastically increase precise indexing time
     *
     * This applies only to search approach 'precise'.
     * For fuzzy this is always 'includes'
     */
    matchAlgorithm: 'startsWith', // or 'includes'
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
    daysAgo: 7,
    /** How many history items should be fetched at most */
    maxItems: 512,
    /** All history items that start with the URLs given here will be skipped */
    ignoreList: [],
  },

  /**
   * As a fallback, use search machines to find results
   */
  searchEngines: {
    /** Enable or disable search engine links in results */
    enabled: false,
    /**
     * For each entry here, one result will be created - in the order they are defined.
     * The URLs need to include the search querystring (see examples).
     */
    choices: [
      {
        name: 'Google',
        urlPrefix: 'https://www.google.com/search?q=',
      },
      {
        name: 'Bing',
        urlPrefix: 'https://www.bing.com/search?q=',
      },
      {
        name: 'DuckDuckGo',
        urlPrefix: 'https://duckduckgo.com/?q=',
      },
      {
        name: 'dict.cc',
        urlPrefix: 'https://www.dict.cc/?s=',
      },
    ],
  },

  /**
   * Options for the score calculation
   */
  score: {
    /** Filter out all search results below this minimum score */
    minScore: 30,

    /**
     * Minimum ratio of search term matchs to consider a match.
     * Set to 1 to only return results that match all search terms
     * Set to 0 to return all results that match at least one search term, allthough with reduced score
     *
     * This setting only applies to precise search
     */
    minSearchTermMatchRatio: 0.6,

    // RESULT TYPE BASE SCORES
    // Depending on the type of result, they start with a base score
    // Please make sure that this is not below the minScore :)

    /** Base score for bookmark results */
    bookmarkBaseScore: 100,
    /** Base score for tab results */
    tabBaseScore: 70,
    /** Base score for history results */
    historyBaseScore: 50,
    /** Base score for search engine entries */
    searchEngineBaseScore: 30,

    // FIELD WEIGHTS
    // Depending on in which field the search match was found,
    // the match gets a multiplier applied on how important the match is.

    /** Weight for a title match*/
    titleWeight: 1,
    /** Weight for a tag match*/
    tagWeight: 0.7,
    /** Weight for an url match*/
    urlWeight: 0.6,
    /** Weight for a folder match*/
    folderWeight: 0.5,

    // BONUS SCORES
    // If certain conditions apply, extra score points can be added

    /**
     * If enabled, bookmarks can add custom bonus scores by putting it in the title
     * HowTo: Add a ` +<score>` (space, plus sign, whole number) in the title before tags.
     * Do not add bonus scores more than once in a single bookmark title.
     * E.g: `Bookmark Title +20` or `Another Bookmark +10 #tag1 #tag2`
     * */
    customBonusScore: true,

    /**
     * For each exact "includes" match we add some bonus points
     */
    exactIncludesBonus: 5,
    /**
     * Additional score points if title or url starts exactly with the search text.
     * This comes on top of an include bonus.
     */
    exactStartsWithBonus: 10,
    /**
     * Additional score points if title matches excactly with the search text.
     * This comes on top of an include and starts with bonus.
     */
    exactEqualsBonus: 15,
    /**
     * Additional points for an exact match of a search term tag (including #)
     */
    exactTagMatchBonus: 10,
    /**
     * Additional points for an exact match of a search term folder name (including ~)
     */
    exactFolderMatchBonus: 5,

    /**
     * Adds score points for every site visit according to browsing history
     * Please note that only history items within `history.daysAgo` can be considered,
     * however the visited counter itself considers your complete history.
     */
    visitedBonusScore: 0.25,
    /** Maximum score points for visited bonus */
    visitedBonusScoreMaximum: 10,

    /**
     * Adds score points when a bookmark or history has been accessed recently.
     * Calculated by taking the recentBonusScoreMaximum and substracting recentBonusScorePerHour
     * for each hour the access happened in the past.
     * There is no negative score.
     *
     * Example: If maximum is 24 and perHour is 0.5:
     * * For a page just opened there will be ~20 bonus score
     * * For a page opened 24 hours ago there will be 10 bonus score
     * * For a page opened 48 hours ago there will be 0 bonus score
     */
    recentBonusScorePerHour: 0.5,
    recentBonusScoreMaximum: 20,

    /**
     * Adds score points when a bookmark has been added more recently.
     * Calculated by taking the dateAddedBonusScoreMaximum and substracting dateAddedBonusScorePerDay
     * for each day the bookmark has been added in the past.
     * There is no negative score.
     */
    dateAddedBonusScorePerDay: 0.1,
    dateAddedBonusScoreMaximum: 5,
  },
}

/**
 * If there are no options yet, use this as an empty options template
 */
export const emptyOptions = {
  general: {},
  search: {},
}

/**
 * Writes user settings to the google chrome sync storage
 *
 * @see https://developer.chrome.com/docs/extensions/reference/storage/
 */
export async function setUserOptions(userOptions) {
  return new Promise((resolve, reject) => {
    if (ext.browserApi.storage) {
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
 * Get user options.
 * If none are stored yet, this will return the default empty options
 */
export async function getUserOptions() {
  return new Promise((resolve, reject) => {
    if (ext.browserApi.storage) {
      ext.browserApi.storage.sync.get(['userOptions'], (result) => {
        if (ext.browserApi.runtime.lastError) {
          return reject(ext.browserApi.runtime.lastError)
        }
        return resolve(result.userOptions || emptyOptions)
      })
    } else {
      console.warn('No storage API found. Falling back to local Web Storage')
      const userOptions = window.localStorage.getItem('userOptions')
      return resolve(userOptions ? JSON.parse(userOptions) : emptyOptions)
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
