# User Options

This document lists all available configuration options for the extension.
You can customize these options in the extension settings using **YAML** or **JSON** format.

For advanced users, you can also inspect the [JSON Schema](https://raw.githubusercontent.com/Fannon/search-bookmarks-history-and-tabs/main/popup/json/options.schema.json) for a formal definition of all properties and constraints.

## General Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `debug` | boolean | `false` | Enable detailed logging in the browser console. |

## Search Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `searchStrategy` | string | `'precise'` | Search approach: `'precise'` (faster, only exact matches) or `'fuzzy'` (slower, finds approximate matches using [uFuzzy](https://github.com/leeoniya/uFuzzy)). |
| `searchMaxResults` | number | `24` | Maximum number of search results to display. Lower values improve performance. Does not apply to tag and folder search (which show all matches). |
| `searchFuzzyness` | number | `0.6` | Fuzzy search tolerance (0–1). Higher values find more approximate matches but may return less relevant results. Only applies when `searchStrategy` is `'fuzzy'`. |

## Colors and Style

These options control the left-side color stripe that indicates result types.
All values are CSS color strings (e.g., `'#3c8d8d'`, `'rgb(60,141,141)'`, `'teal'`).

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `bookmarkColor` | string | `'#3c8d8d'` | Color for bookmark results (teal). |
| `tabColor` | string | `'#b89aff'` | Color for open tab results (purple). |
| `historyColor` | string | `'#9ece2f'` | Color for history results (lime green). |
| `searchColor` | string | `'#e1a535'` | Color for search engine results (amber). |
| `customSearchColor` | string | `'#ce5c2f'` | Color for custom search engine results (orange). |
| `directColor` | string | `'#7799CE'` | Color for direct URL navigation results (blue). |

## Search Sources

Toggle which data sources are included in search results.

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `enableTabs` | boolean | `true` | Include open browser tabs in search results. |
| `enableBookmarks` | boolean | `true` | Include bookmarks in search results. |
| `enableHistory` | boolean | `true` | Include browsing history in search results. Note: The browser history API can be slow; see History Options for tuning. |
| `enableSearchEngines` | boolean | `true` | Show search engine links as fallback results (e.g., "Search Google for..."). |
| `enableHelp` | boolean | `true` | Show help tips when the popup opens. |
| `enableDirectUrl` | boolean | `true` | When typing a URL-like term (e.g., `example.com`), offer direct navigation as a result. |

## Display Options

Control what information is shown in search result items.

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `displayTags` | boolean | `true` | Extract and display `#tags` from bookmark titles as clickable badges. Setting to `false` hides badges but does NOT disable tag search mode (`#`). |
| `displayFolderName` | boolean | `true` | Display bookmark folder paths as clickable badges. Setting to `false` hides badges but does NOT disable folder search mode (`~`). |
| `displaySearchMatchHighlight` | boolean | `true` | Highlight matching text in results with `<mark>` tags. Disabling slightly improves render performance. |
| `displayTabGroup` | boolean | `true` | Display tab group names as clickable purple badges. Setting to `false` hides badges but does NOT disable group search mode (`@`). |
| `displayLastVisit` | boolean | `true` | Show relative time since last visit (e.g., "2h ago"). |
| `displayVisitCounter` | boolean | `false` | Show total visit count from browsing history. |
| `displayDateAdded` | boolean | `false` | Show date when bookmark was added. |
| `displayScore` | boolean | `true` | Show the relevance score next to each result (useful for debugging scoring). |

## Bookmarks Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `bookmarksIgnoreFolderList` | array | `[]` | List of folder names to exclude from search. All bookmarks in these folders (and their subfolders) will be ignored. Example: `['Archive', 'Old Bookmarks']` |
| `detectDuplicateBookmarks` | boolean | `false` | Detect bookmarks with identical URLs and mark them with a red "D" badge. Useful for cleaning up duplicates. Disable for faster startup with large collections. |

## Tabs Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `tabsOnlyCurrentWindow` | boolean | `false` | If `true`, only search and switch to tabs in the current browser window. |
| `maxRecentTabsToShow` | number | `8` | Number of recently visited tabs to show when the popup opens (before typing). Set to `0` to disable. Lower values improve startup performance. |

## History Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `historyDaysAgo` | number | `14` | How many days of history to load. Larger values increase startup time. |
| `historyMaxItems` | number | `1024` | Maximum number of history items to load. The browser history API can be slow; reduce this for faster startup. |
| `historyIgnoreList` | array | `['extension://']` | URL substrings to exclude from history. Items matching any pattern are skipped. Example: `['extension://', 'localhost', '127.0.0.1']` |

## Search Engines Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `searchEngineChoices` | array | See below | Search engines shown as fallback results. Each entry appears in order. Use `$s` in `urlPrefix` as placeholder for the search term. |
| `customSearchEngines` | array | See below | Alias-triggered search engines. Type the alias followed by a space (e.g., `g react`) to search. Supports `blank` URL for when no search term is provided. |

**Default `searchEngineChoices`:**
```yaml
searchEngineChoices:
  - name: Google
    urlPrefix: https://www.google.com/search?q=$s
```

**Default `customSearchEngines`:**
```yaml
customSearchEngines:
  - alias: [g, google]
    name: Google
    urlPrefix: https://www.google.com/search?q=$s
    blank: https://www.google.com
  - alias: [d, dict]
    name: dict.cc
    urlPrefix: https://www.dict.cc/?s=$s
    blank: https://www.dict.cc
```

## Score Calculation Options

Results are ranked by score. Higher scores appear first.

The scoring system uses a **5-step process**:
1. **Base Score** — Start with a score based on result type (bookmark, tab, history, etc.)
2. **Search Quality** — Multiply by how well the result matches the search (0–1 from fuzzy/precise algorithm)
3. **Match Bonuses** — Add points for exact matches, substring matches, tag/folder matches
4. **Usage Signals** — Add points based on visit count and recency
5. **Custom Bonus** — Add user-defined bonus from bookmark titles (e.g., `+20`)

For a detailed explanation, see the [Scoring System section in README.md](https://github.com/Fannon/search-bookmarks-history-and-tabs#scoring-system).

### Base Scores (by result type)

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `scoreBookmarkBase` | number | `100` | Starting score for bookmark results. |
| `scoreTabBase` | number | `70` | Starting score for open tab results. |
| `scoreHistoryBase` | number | `45` | Starting score for history results. |
| `scoreSearchEngineBase` | number | `30` | Starting score for search engine fallback results. |
| `scoreCustomSearchEngineBase` | number | `400` | Starting score for alias-triggered custom search results (high to appear first). |
| `scoreDirectUrlScore` | number | `500` | Score for direct URL navigation (highest priority). |

### Field Weights (where match was found)

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `scoreTagWeight` | number | `0.7` | Multiplier applied when search matches a tag. |
| `scoreGroupWeight` | number | `0.7` | Multiplier applied when search matches a tab group name. |
| `scoreUrlWeight` | number | `0.6` | Multiplier applied when search matches the URL. |
| `scoreFolderWeight` | number | `0.5` | Multiplier applied when search matches a folder name. |

### Match Bonuses

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `scoreExactIncludesBonus` | number | `5` | Bonus for each word that appears as a substring in title/URL (up to 3 bonuses). |
| `scoreExactStartsWithBonus` | number | `10` | Additional bonus when title or URL starts with the search term. |
| `scoreExactEqualsBonus` | number | `20` | Additional bonus when title exactly matches the search term. |
| `scoreExactTagMatchBonus` | number | `15` | Bonus when searching `#tag` and a bookmark has that exact tag. |
| `scoreExactGroupMatchBonus` | number | `15` | Bonus when searching `@group` and a tab is in that exact group. |
| `scoreExactFolderMatchBonus` | number | `10` | Bonus when searching `~folder` and a bookmark is in that exact folder. |
| `scoreExactPhraseTitleBonus` | number | `8` | Bonus when the full multi-word phrase appears in the title (e.g., "react hooks" in title). |
| `scoreExactPhraseUrlBonus` | number | `5` | Bonus when the full multi-word phrase appears in URL (hyphen-normalized: "react hooks" → "react-hooks"). |

### Usage Signals

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `scoreVisitedBonusScore` | number | `0.5` | Points added per visit count from history. |
| `scoreVisitedBonusScoreMaximum` | number | `20` | Cap on visit count bonus. |
| `scoreRecentBonusScoreMaximum` | number | `20` | Max bonus for recently visited items. Scales linearly: just visited = max, `historyDaysAgo` old = 0. |
| `scoreBookmarkOpenTabBonus` | number | `10` | Bonus when a bookmark is also open as a tab. |
| `scoreCustomBonusScore` | boolean | `true` | Enable custom bonus in bookmark titles. Add `+N` before tags (e.g., `My Site +20 #work`). |

## Power User Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `uFuzzyOptions` | object | `{}` | Advanced options passed to the [uFuzzy library](https://github.com/leeoniya/uFuzzy). Use for CJK support or custom fuzzy behavior. See [uFuzzy options](https://github.com/leeoniya/uFuzzy#options). |

---

## AI Config Generation

You can use an LLM (like ChatGPT, Claude, or Gemini) to generate a configuration for you.
Copy the following prompt and adjust the "What I want" section:

> I want to configure the "Search Bookmarks, History and Tabs" browser extension.
> Here is the link to the default options file which shows all available options and their defaults:
> [https://github.com/Fannon/search-bookmarks-history-and-tabs/blob/main/popup/js/model/options.js](https://github.com/Fannon/search-bookmarks-history-and-tabs/blob/main/popup/js/model/options.js)
>
> **What I want:**
> - I want to prioritize open tabs over everything else.
> - I don't want to see history items.
> - I want to use fuzzy search.
>
> Please generate a valid YAML configuration that I can paste into the extension settings. Only include options that are different from the defaults.
