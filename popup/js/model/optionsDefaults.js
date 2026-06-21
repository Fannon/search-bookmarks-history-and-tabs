/**
 * @file Defines extension option defaults.
 */

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
  /**
   * Open results in the current tab by default.
   * When enabled, hold Shift/Alt to open in a new tab instead (the opposite of the default behavior).
   */
  openInCurrentTab: false,

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
  /** Detect URL-shaped terms and offer direct navigation */
  enableDirectUrl: true,
  /** Folder name or ID used by the default result that bookmarks the active tab. Set to false to disable. */
  quickBookmarkCurrentTab: 'Bookmarks bar',

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
  /** Display default placeholder icons for each result type */
  displayIcons: false,
  /** Display website favicons next to results (Chrome only for bookmarks/history) */
  displayFavicons: false,

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
