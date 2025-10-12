import { printError } from '../helper/utils.js'

/**
 * The default options.
 *
 * See /popup/json/options.schema.json for documentation and validation details.
 * They can be selectively overwritten and customized via user options.
 */
export const defaultOptions = {
  debug: false,
  searchStrategy: 'precise',
  searchMaxResults: 32,
  searchMinMatchCharLength: 1,
  searchFuzzyness: 0.6,
  searchDebounceMs: 100,
  colorStripeWidth: 5,
  bookmarkColor: '#3c8d8d',
  tabColor: '#b89aff',
  historyColor: '#9ece2f',
  searchColor: '#e1a535',
  customSearchColor: '#ce5c2f',
  directColor: '#7799CE',
  enableTabs: true,
  enableBookmarks: true,
  enableHistory: true,
  enableSearchEngines: true,
  enableHelp: true,
  enableDirectUrl: true,
  displayTags: true,
  displayFolderName: true,
  displaySearchMatchHighlight: true,
  displayLastVisit: true,
  displayVisitCounter: false,
  displayDateAdded: false,
  displayScore: true,
  bookmarksIgnoreFolderList: [],
  tabsOnlyCurrentWindow: false,
  maxRecentTabsToShow: 16,
  historyDaysAgo: 14,
  historyMaxItems: 1024,
  historyIgnoreList: ['extension://'],
  searchEngineChoices: [
    {
      name: 'Google',
      urlPrefix: 'https://www.google.com/search?q=$s',
    },
    {
      name: 'Bing',
      urlPrefix: 'https://www.bing.com/search?q=$s',
    },
    {
      name: 'dict.cc',
      urlPrefix: 'https://www.dict.cc/?s=$s',
    },
  ],
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
  scoreMinScore: 30,
  scoreMinSearchTermMatchRatio: 0.6,
  scoreBookmarkBaseScore: 100,
  scoreTabBaseScore: 70,
  scoreHistoryBaseScore: 45,
  scoreSearchEngineBaseScore: 30,
  scoreCustomSearchEngineBaseScore: 400,
  scoreDirectUrlScore: 500,
  scoreTitleWeight: 1,
  scoreTagWeight: 0.7,
  scoreUrlWeight: 0.6,
  scoreFolderWeight: 0.5,
  scoreCustomBonusScore: true,
  scoreExactIncludesBonus: 5,
  scoreExactIncludesBonusMinChars: 3,
  scoreExactStartsWithBonus: 10,
  scoreExactEqualsBonus: 15,
  scoreExactTagMatchBonus: 10,
  scoreExactFolderMatchBonus: 5,
  scoreVisitedBonusScore: 0.5,
  scoreVisitedBonusScoreMaximum: 20,
  scoreRecentBonusScoreMaximum: 20,
  titleLengthRestrictionForUrls: 80,
  uFuzzyOptions: {},
}

export const emptyOptions = {
  searchStrategy: defaultOptions.searchStrategy,
}

/**
 * Writes user settings to the sync storage, falls back to local storage
 *
 * @see https://developer.chrome.com/docs/extensions/reference/storage/
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

export function validateUserOptions(userOptions) {
  if (userOptions) {
    if (typeof userOptions !== 'object') {
      throw new Error('User options must be a valid YAML / JSON object')
    }
    try {
      JSON.stringify(userOptions)
    } catch (err) {
      throw new Error('User options cannot be parsed into JSON: ' + err.message)
    }
  }
}
