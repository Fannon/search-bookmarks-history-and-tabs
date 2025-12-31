# User Options

This document lists all available configuration options for the extension.
You can customize these options in the extension settings using YAML or JSON format.

## Search Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `searchStrategy` | string | `'precise'` | Search approach to use. `'precise'` (faster, exact matches) or `'fuzzy'` (slower, approximate matches). |
| `searchMaxResults` | number | `32` | Max search results. Reduce for better performance. |
| `searchMinMatchCharLength` | number | `1` | Minimum characters of the search term to consider a match. |
| `searchFuzzyness` | number | `0.6` | Fuzzy search threshold (0-1). 0 is no fuzzyness, 1 is full fuzzyness. Only applies to `'fuzzy'` strategy. |

## Colors and Style

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `colorStripeWidth` | number | `5` | Width of the left color marker in search results in pixels. |
| `bookmarkColor` | string | `'#3c8d8d'` | Color for bookmark results (CSS color). |
| `tabColor` | string | `'#b89aff'` | Color for tab results (CSS color). |
| `historyColor` | string | `'#9ece2f'` | Color for history results (CSS color). |
| `searchColor` | string | `'#e1a535'` | Color for search results (CSS color). |
| `customSearchColor` | string | `'#ce5c2f'` | Color for custom search results (CSS color). |
| `directColor` | string | `'#7799CE'` | Color for direct URL results (CSS color). |

## Search Sources

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `enableTabs` | boolean | `true` | Whether to index and search for open browser tabs. |
| `enableBookmarks` | boolean | `true` | Whether to index and search for bookmarks. |
| `enableHistory` | boolean | `true` | Whether to index and search for browsing history. |
| `enableSearchEngines` | boolean | `true` | Enable or disable search engine links in results. |
| `enableHelp` | boolean | `true` | Enable help and tips on startup. |
| `enableDirectUrl` | boolean | `true` | Whether to treat URL-like terms as directly navigable. |

## Display Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `displayTags` | boolean | `true` | Extract tags from title and display as badge. Disabling also disables tag overview/search. |
| `displayFolderName` | boolean | `true` | Display and search folder names. Disabling also disables folder overview/search. |
| `displaySearchMatchHighlight` | boolean | `true` | Highlight search matches in results. |
| `displayLastVisit` | boolean | `true` | Display last visit (time ago). |
| `displayVisitCounter` | boolean | `false` | Display how many times a result was visited. |
| `displayDateAdded` | boolean | `false` | Display date when a bookmark was added. |
| `displayScore` | boolean | `true` | Display result score (relevance). |

## Bookmarks Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `bookmarksIgnoreFolderList` | array | `[]` | Ignores all bookmarks within listed folders (and subfolders). |
| `detectDuplicateBookmarks` | boolean | `false` | Detect and mark duplicate bookmarks. Disabling improves startup performance. |
| `detectBookmarksWithOpenTabs` | boolean | `true` | Detect and mark bookmarks that have a currently open browser tab. |

## Tabs Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `tabsOnlyCurrentWindow` | boolean | `false` | If true, only the current browser window is considered for tab indexing. |
| `maxRecentTabsToShow` | number | `8` | Number of recent tabs to show when popup is opened without search term. 0 to disable. |

## History Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `historyDaysAgo` | number | `14` | How many days ago the browser history should be fetched. |
| `historyMaxItems` | number | `1024` | Max history items to fetch. High values impact performance. |
| `historyIgnoreList` | array | `['extension://']` | History items with URLs including these strings will be skipped. |

## Search Engines Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `searchEngineChoices` | array | `[{name: 'Google', urlPrefix: '...'}]` | Search Engine "Providers" used to pass on the search term via URL. |
| `customSearchEngines` | array | `[...]` | Define custom search engines with their own aliases (e.g., `g ` for Google). |

## Score Calculation Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `scoreMinScore` | number | `30` | Filter out all search results below this minimum score. |
| `scoreBookmarkBase` | number | `100` | Base score for bookmark results. |
| `scoreTabBase` | number | `70` | Base score for tab results. |
| `scoreHistoryBase` | number | `45` | Base score for history results. |
| `scoreSearchEngineBase` | number | `30` | Base score for search engine choices. |
| `scoreCustomSearchEngineBase` | number | `400` | Base score for custom search engine choices. |
| `scoreDirectUrlScore` | number | `500` | Base score for direct URL results. |
| `scoreTitleWeight` | number | `1` | Weight for a title match. |
| `scoreTagWeight` | number | `0.7` | Weight for a tag match. |
| `scoreUrlWeight` | number | `0.6` | Weight for a URL match. |
| `scoreFolderWeight` | number | `0.5` | Weight for a folder match. |
| `scoreCustomBonusScore` | boolean | `true` | Enable custom bonus scores in bookmark titles (e.g., `Title +20`). |
| `scoreExactIncludesBonus` | number | `5` | Bonus points for each exact "includes" match. |
| `scoreExactIncludesMaxBonuses` | number | `3` | Max number of substring bonuses per result. |
| `scoreExactIncludesBonusMinChars` | number | `3` | Min characters for exact includes match. |
| `scoreExactStartsWithBonus` | number | `10` | Bonus if title/URL starts exactly with search text. |
| `scoreExactEqualsBonus` | number | `20` | Bonus if title matches exactly with search text. |
| `scoreExactTagMatchBonus` | number | `15` | Bonus for exact match of a search term tag. |
| `scoreExactFolderMatchBonus` | number | `10` | Bonus for exact match of a search term folder name. |
| `scoreExactPhraseTitleBonus` | number | `8` | Bonus if full search phrase appears in title. |
| `scoreExactPhraseUrlBonus` | number | `5` | Bonus if full search phrase appears in URL. |
| `scoreVisitedBonusScore` | number | `0.5` | Points per site visit. |
| `scoreVisitedBonusScoreMaximum` | number | `20` | Max points for visited bonus. |
| `scoreRecentBonusScoreMaximum` | number | `20` | Max bonus for recently visited items. |
| `scoreBookmarkOpenTabBonus` | number | `10` | Bonus when a bookmark is also currently open as a tab. |

## Power User Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `titleLengthRestrictionForUrls` | number | `80` | Shorten title if it's just the URL. |
| `uFuzzyOptions` | object | `{}` | Customized options for uFuzzy library. |

---

## AI Config Generation

You can use an LLM (like ChatGPT, Claude, or Gemini) to generate a configuration for you.
Copy the following prompt and adjust the "What I want" section:

> I want to configure the "Search Bookmarks, History and Tabs" browser extension.
> Here is the link to the default options file which shows all available options and their defaults:
> [https://github.com/Fannon/search-tabs-bookmarks-and-history/blob/main/popup/js/model/options.js](https://github.com/Fannon/search-tabs-bookmarks-and-history/blob/main/popup/js/model/options.js)
>
> **What I want:**
> - I want to prioritize open tabs over everything else.
> - I don't want to see history items.
> - I want to use fuzzy search.
>
> Please generate a valid YAML configuration that I can paste into the extension settings. Only include options that are different from the defaults.
