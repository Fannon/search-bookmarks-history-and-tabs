# CHANGELOG

## [v1.8.3]

- **FIXED**: When navigating result items via arrow up, the search text input box curser moved to the beginning of the search string
  - Fix contributed by [@c0001](https://github.com/c0001) in [PR #71](https://github.com/Fannon/search-bookmarks-history-and-tabs/pull/71). Thanks!

## [v1.8.2]

- **FIXED**: Used wrong icon (edit) for closing tabs
- **IMPROVED**: Hover over edit and close icon is now indicated

## [v1.8.1]

- **FIXED**: Missing icon for closing open tabs
  - Tip: This is especially useful if you enter tab search mode via searching `t `
- **FIXED**: Improved very buggy logic to close tabs and update search results

## [v1.8.0]

- **NEW**: Allow definition of custom search engines that are triggered by custom alias
  - New option: `customSearchEngines`, with one default entry: `g ` for executing a google search.
  - Also added `blank` option when no search string is given
  - Allowing for multiple aliases, if defined as an array (`['alias1', 'alias`]`)

## [v1.7.0]

- **CHANGED**: Replaced fuzzy search library fuzzysort with [uFuzzy](https://github.com/leeoniya/uFuzzy)
  - This should give more reliable and relevant search results
  - Performance is a bit better in most cases
  - Related Issue: https://github.com/Fannon/search-bookmarks-history-and-tabs/issues/60
- **IMPROVED**: Performance improvement for both precise and fuzzy search
  - Interim search results are now cached so the search haystack gets smaller when search term is only expanded
- **FIXED**: Custom Bonus Score was sometimes shown in search result title.

## [v1.6.3]

- **CHANGED**: No bundling of external libraries into vendor.min.js as Firefox store objected to this

## [v1.6.1]

- **IMPROVED**: Improved error handling
  - Errors and warnings are now displayed in a dedicated overlay, with more space to show complete context
  - Error handling is more robust, e.g. when failing to load user settings we now display error but fall back to default options

## [v1.6.0]

- **NEW**: Removed indexing phase entirely, which leads to faster load times
- **NEW**: Added close tab functionality
  - See PR [#38](https://github.com/Fannon/search-bookmarks-history-and-tabs/pull/38)
- **CHANGED**: Removed flexsearch dependency and implemented simpler 'precise' search
  - With this change, the new precise search does not index anymore and therefore the extension is quicker to load
  - The search performance got a bit worse (it's a tradeoff), but is still fast enough
- **CHANGED**: Removed fuse.js for fuzzy search and replaced it with https://github.com/farzher/fuzzysort, which requires no indexing
- **IMPROVED**: Code cleanups and better minimized output, which makes the extension smaller.

## [v1.5.0]

- **NEW**: Added hybrid search approach
  - This combines precise and fuzzy search results
  - This also combines the indexing and search time of both approaches, so be aware of the performance impact.
  - Added two new options to weight precise vs. fuzzy search matches
    - `scoreHybridPreciseBonus`
    - `scoreHybridFuzzyBonus`

## [v1.4.0]

- **NEW**: Bookmark edit now supports:
  - Deleting bookmarks through popup
  - Editing the bookmark URL
- **NEW**: Added support for OR tag and folder search
  - Supports queries like `#github #pr` and `~Sites ~Blogs`
- **Improved**: Search behavior around `scoreExactIncludesBonus`
  - Introduced new option `scoreExactIncludesBonusMinChars` which introduces a minimum character match for above option
- **Improved**: behavior of `scoreExactTagMatchBonus` and `scoreExactFolderMatchBonus` to make it work in more situations
- **NEW**: Rudimentary user option validation, to ensure it at least is a proper YAML / JSON object
- **REMOVED**: Legacy option migration

## [v1.3.0]

- Simplified the user options
  - The options can now be written in YAML or JSON (instead of JSON5 / JSON before)
  - The structure is now flat, so there is no need for object nesting except for advanced options
  - Added inline help to option screen

## v1.2.1

- Added inline tips to popup [#27](https://github.com/Fannon/search-bookmarks-history-and-tabs/pull/27).
- New option: `tabs.displayLastVisited` allows to display the last accessed tabs in the default results when popup is opened [#22](https://github.com/Fannon/search-bookmarks-history-and-tabs/pull/22).

## v1.2.0

- NEW: Results can now be opened in current tab or background tab [#18](https://github.com/Fannon/search-bookmarks-history-and-tabs/pull/18).
  - By default, the extension will open the selected result in a new active tab, or switch to an existing tab with the target url.
  - Hold `Shift` or `Alt` to open the result in the current tab
  - Hold `Ctrl` to open the result without closing the popup.
- NEW: Added new option to optionally disable use of folder names in bookmarks:
  - `{ "general": {"folderName": true } }`
- IMPROVEMENT: Minor performance optimizations (load time)
- FIX: Tag edit text was not well readable in dark mode
- FIX: Disabling `general.tags` was not fully implemented.

## v1.1.0

- Adjusted default options
  - precise search is now standard
  - history goes back 7 days
  - search engines are disabled by default
  - Reduced default base score for open tabs

## v1.0.3

- Support for Opera when delivered through Opera addons
- Burned v1.0.2 on the way :)

## v1.0.1

- Changed icon to dark icon and improved display at small size

## v1.0.0

- Official 1.0 stable release
- No feature changes, just adding tests and ensuring stability

## v0.9.9

- NEW: Show default results when in bookmark, tab or history search mode
  - Tab search mode: Shows all open tabs, sorted by last visit
  - History search mode: Shows most recent history results, sorted by last visit
  - Bookmark search mode: Shows highest ranked bookmarks, sorted by score
- Minor bug fixes and improvements

## v0.9.8

- NEW: Allow custom bonus score by adding it directly to a bookmark title (see documentation)
- NEW: Optionally display bookmark added date in search result
- NEW: Bookmark recently added can affect score (incl. two options to fine-tune it).

## v0.9.7

- NEW: Score now also considers how recently a page was visited (incl. two options to fine-tune it).

## v0.9.6

- Renamed extension to "Search Bookmarks, History and Tabs"
