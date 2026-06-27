# User Options

This document lists all available configuration options for the extension.
You can customize these options in the Bookmark Manager's **Options** page using a schema-driven form and a synced **YAML** editor.
Only options you explicitly customize need to be saved; everything else falls back to defaults.
If you need help, consider [AI Config Generation](#ai-config-generation).

For advanced users, you can also inspect the [JSON Schema](https://raw.githubusercontent.com/Fannon/search-bookmarks-history-and-tabs/main/popup/json/options.schema.json) for a formal definition of all properties and constraints.

## Search Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `searchStrategy` | string | `'precise'` | Search approach: `'precise'` (faster, only exact matches) or `'fuzzy'` (slower, finds approximate matches using [uFuzzy](https://github.com/leeoniya/uFuzzy)). |
| `searchMaxResults` | integer | `24` | Maximum number of search results to display. Lower values improve performance. Does not apply to tag and folder search (which show all matches). |
| `searchFuzzyness` | number | `0.6` | Fuzzy search tolerance (0–1). Higher values find more approximate matches but may return less relevant results. Only applies when `searchStrategy` is `'fuzzy'`. |
| `openInCurrentTab` | boolean | `false` | Open results in the current tab by default. When enabled, hold `Shift` or `Alt` to open in a new tab instead (inverts the default behavior). |

## Colors and Style

These options control the left-side color stripe that indicates result types.
All values are hex color strings (e.g., `'#3c8d8d'` or `'#fff'`).

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
| `enableDirectUrl` | boolean | `true` | When typing a URL-like term (e.g., `example.com`), offer direct navigation as a result. |
| `quickBookmarkCurrentTab` | string or `false` | `'Bookmarks bar'` | Folder name or folder ID used by the first default result that opens the rich bookmark editor for saving the active tab. Folder IDs are more reliable across localized browsers than English folder names like the default. Use `false`, an empty string, or only whitespace to disable that result. |

## Display Options

Control what information is shown in search result items.

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `displayTags` | boolean | `true` | Extract and display `#tags` from bookmark titles as clickable badges. Setting to `false` hides badges but does NOT disable tag search mode (`#`). |
| `displayFolderName` | boolean | `true` | Display bookmark folder paths as clickable badges. Setting to `false` hides badges but does NOT disable folder search mode (`~`). |
| `displayTabGroup` | boolean | `true` | Display tab group names as clickable purple badges. Setting to `false` hides badges but does NOT disable group search mode (`@`). |
| `displaySearchMatchHighlight` | boolean | `true` | Highlight matching text in results with `<mark>` tags. Disabling slightly improves render performance. |
| `displayLastVisit` | boolean | `true` | Show relative time since last visit (e.g., "2h ago"). |
| `displayVisitCounter` | boolean | `false` | Show total visit count from browsing history. |
| `displayDateAdded` | boolean | `false` | Show date when bookmark was added. |
| `displayScore` | boolean | `true` | Show the relevance score next to each result (useful for debugging scoring). |
| `displayFavicons` | boolean | `false` | Show real website favicons next to results. See [Website Favicons](#website-favicons) for details and privacy information. |

## Bookmarks Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `bookmarksIgnoreFolderList` | array | `[]` | List of bookmark folder paths to exclude from search. All bookmarks in these folders (and their subfolders) will be ignored. Example: `['Archive', 'Work/Old Bookmarks']` |

## Tabs Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `tabsOnlyCurrentWindow` | boolean | `false` | If `true`, only search and switch to tabs in the current browser window. |
| `maxRecentTabsToShow` | integer | `8` | Number of recently visited tabs to show when the popup opens (before typing). Set to `0` to disable. Lower values improve startup performance. |

## History Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `historyDaysAgo` | integer | `14` | How many days of history to load. Larger values increase startup time. |
| `historyMaxItems` | integer | `1024` | Maximum number of history items to load. The browser history API can be slow; reduce this for faster startup. |
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
| `scoreBookmarkBase` | integer | `100` | Starting score for bookmark results. |
| `scoreTabBase` | integer | `70` | Starting score for open tab results. |
| `scoreHistoryBase` | integer | `45` | Starting score for history results. |
| `scoreSearchEngineBase` | integer | `30` | Starting score for search engine fallback results. |
| `scoreCustomSearchEngineBase` | integer | `400` | Starting score for alias-triggered custom search results (high to appear first). |
| `scoreDirectUrlScore` | integer | `500` | Score for direct URL navigation (highest priority). |

### Field Weights (where match was found)

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `scoreTagWeight` | number | `0.7` | Multiplier applied when search matches a tag. |
| `scoreUrlWeight` | number | `0.6` | Multiplier applied when search matches the URL. |
| `scoreGroupWeight` | number | `0.7` | Multiplier applied when search matches a tab group name. |
| `scoreFolderWeight` | number | `0.5` | Multiplier applied when search matches a folder name. |

### Match and Custom Bonuses

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `scoreCustomBonusScore` | boolean | `true` | Enable custom bonus in bookmark titles. Add `+N` before tags (e.g., `My Site +20 #work`). |
| `scoreExactIncludesBonus` | integer | `5` | Bonus for each word that appears as a substring in title/URL (up to 3 bonuses). |
| `scoreExactStartsWithBonus` | integer | `10` | Additional bonus when title or URL starts with the search term. |
| `scoreExactEqualsBonus` | integer | `20` | Additional bonus when title exactly matches the search term. |
| `scoreExactTagMatchBonus` | integer | `15` | Bonus when searching `#tag` and a bookmark has that exact tag. |
| `scoreExactFolderMatchBonus` | integer | `10` | Bonus when searching `~folder` and a bookmark is in that exact folder. |
| `scoreExactGroupMatchBonus` | integer | `15` | Bonus when searching `@group` and a tab is in that exact group. |
| `scoreExactPhraseTitleBonus` | integer | `8` | Bonus when the full multi-word phrase appears in the title (e.g., "react hooks" in title). |
| `scoreExactPhraseUrlBonus` | integer | `5` | Bonus when the full multi-word phrase appears in URL (hyphen-normalized: "react hooks" → "react-hooks"). |

### Usage Signals

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `scoreVisitedBonusScore` | number | `0.5` | Points added per visit count from history. |
| `scoreVisitedBonusScoreMaximum` | integer | `20` | Cap on visit count bonus. |
| `scoreRecentBonusScoreMaximum` | integer | `20` | Max bonus for recently visited items. Scales linearly: just visited = max, `historyDaysAgo` old = 0. |
| `scoreBookmarkOpenTabBonus` | integer | `10` | Bonus when a bookmark is also open as a tab. |

## Power User Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `uFuzzyOptions` | object | `{}` | Advanced options passed to the [uFuzzy library](https://github.com/leeoniya/uFuzzy). Use for CJK support or custom fuzzy behavior. See [uFuzzy options](https://github.com/leeoniya/uFuzzy#options). |

## Website Favicons

Set **`displayFavicons: true`** to show website favicons next to search results when the browser provides an icon.

### Implementation & Privacy

- **No External Requests**: To respect your privacy, this feature is built to make zero external calls. Icons are retrieved solely from your browser's local cache.
- **Chrome/Edge Native API**: Chromium-based browsers provide a secure, built-in helper (`_favicon`) to retrieve cached icons for your bookmarks and history.
- **Firefox & Missing Icons**: Firefox does not currently support a native favicon API for background access. When no favicon is available, the result is shown without an icon.
- **Tab Synchronization**: If a bookmark is also an open tab, the extension "borrows" the tab's current icon directly.

### Technical Implementation

To adhere to the principle of least privilege, the **"Read and change your favicons"** permission is handled as an **optional permission**. 

- If you enable `displayFavicons: true`, the browser will prompt you to grant this permission when you click **SAVE**.
- If you never enable favicons, the extension never requests the permission.

Technically, to allow the extension's popup to display these icons, the favicon resource must be declared as "web accessible." This introduces a minor **side-channel privacy risk**: a malicious website that knows this extension's ID could theoretically probe whether a specific domain (like `yourbank.com`) exists in your browser's icon cache. Given the minimal nature of this risk compared to the utility of the feature, it is a standard implementation in most search-centric extensions.

---

## AI Config Generation

You can use an LLM (such as ChatGPT, Claude, or Gemini) to generate a customized configuration for you.

Copy and paste the following "Config Expert" prompt into your favorite AI:

```md
Act as an expert configuration assistant for the [Search Bookmarks, History and Tabs](https://github.com/Fannon/search-bookmarks-history-and-tabs) browser extension.

Generate a valid **YAML** user configuration for the extension.

## Rules
- Use only documented options from the official JSON Schema and documentation.
- Do not invent option names.
- Include only options that should differ from the official defaults.
- Omit any option that would keep its default value.
- Respect all schema types, allowed values, minimums, maximums, and object shapes.
- Prefer conservative settings that keep search fast unless I explicitly ask for broader/slower behavior.
- If my request is ambiguous or conflicts with the schema, ask a brief clarification question instead of guessing.
- Return the configuration as a fenced `yaml` code block.
- You may add a short explanation after the YAML block for non-obvious choices, tradeoffs, or omitted defaults.

## Sources of truth
- JSON Schema: https://raw.githubusercontent.com/Fannon/search-bookmarks-history-and-tabs/main/popup/json/options.schema.json
- Documentation: https://raw.githubusercontent.com/Fannon/search-bookmarks-history-and-tabs/main/OPTIONS.md

## What I want

E.g. I want to prioritize open tabs over everything else.
I want to use fuzzy search and history for only the last 7 days.
```
