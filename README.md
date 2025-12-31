# Search Bookmarks, History and Browser Tabs

🔎 Browser extension to (fuzzy) search and navigate bookmarks, history and open tabs.

## Installation

- [Chrome Extension](https://chrome.google.com/webstore/detail/tabs-bookmark-and-history/cofpegcepiccpobikjoddpmmocficdjj?hl=en-GB&authuser=0)
- [Microsoft Edge Addon](https://microsoftedge.microsoft.com/addons/detail/search-tabs-bookmarks-an/ldmbegkendnchhjppahaadhhakgfbfpo)
- [Firefox Addon](https://addons.mozilla.org/en-US/firefox/addon/search-tabs-bookmarks-history/)
- [Opera Addon](https://addons.opera.com/en/extensions/details/search-bookmarks-history-and-tabs/) (only an old version)

## Features

**This extension does not collect any data nor does it make any external requests** (see [Privacy](#privacy--data-protection)).

It supports two different search approaches:

- **Exact search** (case-insensitive, but exact matching): Faster, but only exact matching results.
- **Fuzzy search** (approximate matching): Slower, but also includes inexact (fuzzy) matches.

With this extension you can also **tag your bookmarks** including auto completions.
The tags are considered when searching and can be used for navigation.

The extension is very customizable (see [user options](#user-configuration)) and has a dark / light theme that is selected based on your system settings (see [prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme)). It's also very lightweight (< 150kb JavaScript, including dependencies).

> 💡 Have a look at the [Tips & Tricks](./Tips.md) collection.

> 🗎 For a list of recent changes, see [CHANGELOG.md](./CHANGELOG.md).

## Screenshots & Demo

![Demo Animation](/images/bookmark-and-history-search.gif 'Demo Animation')

## User Documentation

- **Search Strategies**: Switch between precise and fuzzy approach by clicking on the FUZZY or PRECISE button in the search bar (top right).
- **Keyboard Shortcut**: Trigger the extension via keyboard.
  - The default is `CTRL` + `Shift` + `.`, but you can customize this (I personally use `Ctrl+J`).
- **Open selected results**: By default, the extension will open the selected result in a new active tab, or switch to an existing tab with the target URL.
  - Hold `Shift` or `Alt` to open the result in the current tab.
  - Hold `Ctrl` to open the result without closing the popup.
  - Right-click to copy URL to clipboard.
- **Search Modes**: In case you want to be more selective -> use a search mode:
  - Start your query with `#`: only **bookmarks with the tag** will be returned (exact "starts with" search)
    - Supports AND search, e.g. search for `#github #pr` to only get results which have both tags
  - Start your query with `~`: only **bookmarks within the folder** will be returned (exact "starts with" search)
    - Supports AND search, e.g. search for `~Sites ~Blogs` to only get results which have both tags
  - Start your query with `b ` (including space): only **bookmarks** will be searched.
  - Start your query with `h ` (including space): only **history** and **open tabs** will be searched.
  - Start your query with `t ` (including space): only **open tabs** will be searched.
  - Start your query with `s ` (including space): only **search engines** will be proposed.
  - Custom Aliases:
    - The option `customSearchEngines` allows you to define your own search mode aliases
    - Default: Start your query with `g ` (including space): Do a Google search.
    - Default: Start your query with `d ` (including space): Do a dict.cc search.
  - A search term that can be interpreted as URL (e.g. `example.com`) can be navigated to directly.
- **Emacs / Vim Navigation**:
  - `Ctrl+J` and `Ctrl+N` to navigate search results up
  - `Ctrl+K` and `Ctrl+P` to navigate search results down
- **Special Browser Pages**: You can add special browser pages to your bookmarks, like `chrome://downloads`.
- **Custom Scores**: Add custom bonus scores by putting ` +<whole number>` to your bookmark title (before tags)
  - Examples: `Bookmark Title +20` or `Another Bookmark +10 #tag1 #tag2`
- **Tags**:
  - A bookmark title cannot start with a tag, it needs a title
  - Tags cannot start with a number. This is how the extension filters out issue / ticket numbers.
- This extension works best if you avoid:
  - using `#` in bookmark titles that do not indicate a tag.
  - using `~` in bookmark folder names.

## User Configuration

The extension is highly customizable.
Finding and setting options is a bit technical, though.

The user options are written in [YAML](https://en.wikipedia.org/wiki/YAML) or [JSON](https://en.wikipedia.org/wiki/JSON) notation.

For now, there is no nice options overview, so you have to find them in the [popup/js/model/options.js](popup/js/model/options.js) file in the `defaultOptions` object.
From there you can see the available options, their names, default values and descriptions.

> 📘 **See [OPTIONS.md](./OPTIONS.md) for a comprehensive list of all available options.**

When defining your custom config, you only need to define the options that you want to overwrite from the defaults.

> ⚠ The options are not validated properly. Please make sure to use them correctly.<br/>
> If something breaks, consider resetting your options.

An exemplary user config can look like the following example:

```yaml
searchStrategy: fuzzy
displayVisitCounter: true
historyMaxItems: 2048 # Increase max number of browser history items to load
maxRecentTabsToShow: 32 # Limit number of recent tabs shown (default: 8)
```

If you have **troubles with performance**, here are a few options that might help. Feel free to pick & choose and tune the values to your situation. In particular `historyMaxItems` and how many bookmarks you have will impact init and search performance.

Here is a suggestion for low-performance machines:

```yaml
searchStrategy: precise # Precise search is faster than fuzzy search.
searchMinMatchCharLength: 2 # Start searching only when at least 2 characters are entered
displaySearchMatchHighlight: false # Not highlighting search matches improves render performance.
searchMaxResults: 20 # Number of search results can be further limited
historyMaxItems: 512 # Number of browser history items can be further reduced
maxRecentTabsToShow: 4 # Reduce number of recent tabs for better performance
detectDuplicateBookmarks: false # Disable duplicate detection for faster startup (if you don't have duplicates)
detectBookmarksWithOpenTabs: false # Disable bookmark-tab matching for faster startup (if you don't need the feature)
```

Or a more advanced example:

```yaml
searchStrategy: precise
historyDaysAgo: 14
historyMaxItems: 2048
historyIgnoreList:
  - extension://
  - http://localhost
  - http://127.0.0.1
colorStripeWidth: 4 # Customize width of search result color stripe
scoreTabBase: 70 # customize base score for open tabs
detectBookmarksWithOpenTabs: true
detectDuplicateBookmarks: true
maxRecentTabsToShow: 4
searchEngineChoices:
  - name: Google
    urlPrefix: https://google.com/search?q=
customSearchEngines:
  - alias: ['g', 'google']
    name: Google
    urlPrefix: https://www.google.com/search?q=$s
    blank: https://www.google.com
  - alias: d
    name: dict.cc
    urlPrefix: https://www.dict.cc/?s=$s
  - alias: [gh, github]
    name: GitHub
    urlPrefix: https://github.com/search?q=$s
    blank: https://github.com
  - alias: npm
    name: NPM
    urlPrefix: https://www.npmjs.com/search?q=$s
    blank: https://www.npmjs.com
```

In case of making multilingual search (CJK) correctly, you may need to tweak [uFuzzy](https://github.com/leeoniya/uFuzzy) options via option `ufuzzyOptions`, for example:

```yaml
# make CJK chars work for fuzzy search
uFuzzyOptions:
  interSplit: (p{Unified_Ideograph=yes})+
```

## Scoring System

The scoring system calculates a relevance score for each search result using a 5-step process:

1. **Base Score** - Each result type (bookmark, tab, history, search engine) starts with a different base score (e.g. `scoreBookmarkBase: 100`, `scoreTabBase: 70`)
2. **Search Quality Multiplier** - The base score is multiplied by the search library score (0-1), which reflects how good the match is. Fuzzy/precise search algorithms return this quality score.
3. **Field-Specific Bonuses** - Additional points are awarded based on:
   - Exact matches: `scoreExactStartsWithBonus`, `scoreExactEqualsBonus` if title/URL starts with or equals the search term
   - Exact tag/folder matches: `scoreExactTagMatchBonus`, `scoreExactFolderMatchBonus` for direct tag/folder matches
   - Substring matches: `scoreExactIncludesBonus` weighted by field importance (title=1.0, tag=0.7, url=0.6, folder=0.5)
4. **Behavioral Bonuses** - Additional points based on usage patterns:
   - `scoreVisitedBonusScore` - Points per visit (up to `scoreVisitedBonusScoreMaximum`)
   - `scoreRecentBonusScoreMaximum` - Bonus for recently visited items
5. **Custom Bonus** - User-defined bonus via `+<number>` notation in bookmark titles (if `scoreCustomBonusScore` is enabled)

For detailed implementation and all scoring configuration options, see:
- **[popup/js/search/scoring.js](popup/js/search/scoring.js)** - Core scoring algorithm with comprehensive documentation
- **[popup/js/model/options.js](popup/js/model/options.js)** - Complete list of scoring configuration options

## Privacy / Data Protection

This extension is built to respect your privacy:

- It does not have permissions for outside communication, so none of your data is shared or exposed externally.
- The extension does not even store any information except your user settings.
  Every time the extension popup is closed, it "forgets" everything and starts from a blank slate next time you open it.
- There is no background job / processing. If the popup is not explicitly opened by the user, the extension is not executed.
- The extension only requests the following permissions for the given reasons:
  - **bookmarks**: Necessary to read and edit the bookmarks. Can be disabled via [user configuration](#user-configuration).
  - **history**: Necessary to read the browsing history. Can be disabled or limited via [user configuration](#user-configuration).
  - **tabs**: Necessary to find open tabs and to use tabs for navigation. Can be disabled via [user configuration](#user-configuration).
  - **storage**: Necessary to store and retrieve the [user configuration](#user-configuration).
    If the browser has setting synchronization enabled, the extension settings will be synced (in this case you already trust your browser to sync everything else anyway).
    If browser sync is disabled, the user configuration is only stored locally.
- The extension is open source, so feel free to convince yourself :)

## Local Development

Local development setup, project structure, and workflows are documented in [CONTRIBUTING.md#local-development](./CONTRIBUTING.md#local-development).

## Credits

This extension makes use of the following helpful open-source projects (thanks!):

- https://github.com/leeoniya/uFuzzy for the fuzzy search algorithm
- https://github.com/yairEO/tagify for the tag autocomplete widget
- https://markjs.io/ for highlighting search matches
- https://www.npmjs.com/package/js-yaml for the user options parsing
- https://github.com/tabler/tabler-icons for icons
- https://www.joshwcomeau.com/css/custom-css-reset/

## Feedback and Ideas

> Please create a [GitHub issue](https://github.com/Fannon/search-tabs-bookmarks-and-history/issues) to give your feedback.
> All ideas, suggestions or bug reports are welcome.
