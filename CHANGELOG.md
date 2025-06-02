# CHANGELOG

## [unreleased]

## [v1.13.1]

- **FIXED**: Fixed init result not showing current bookmark anymore

## [v1.13.0]

- **Added**: Support for direct URL navigation, contributed by [@berdon](https://github.com/berdon) via [#171](https://github.com/Fannon/search-bookmarks-history-and-tabs/pull/171)
- **ADDED**: The folder and tags label on a bookmark search result are now clickable and will lead to a new search, looking for all bookmarks with the same folder / tags.
- **IMPROVED**: Folders and Tags are now rendered with a badge for each value, now also clickable for navigation

## [v1.12.0]

- **CHANGED**: History cache has been removed as it caused issues with local storage size on some browser and performance gains were not clear enough.
- **FIXED**: Dark mode button hover text color contrast was bad
- **IMPROVED**: Internal code cleanup which leads to less code to load (minimal performance improvement)
- **IMPROVED**: Trying out a potential fix for [#164](https://github.com/Fannon/search-bookmarks-history-and-tabs/issues/164) (Searching too quickly after opening leads to no results found)

## [v1.11.0]

- **FIXED**: Highlight of selected result in light-mode
- **IMPROVED**: Firefox build is now using the browser extension Manifest v3, like Chrome or Edge.
- **REMOVED**: Removed special build for Firefox, using Manifest v2.
- **REMOVED**: Removed special build for Opera (they did not apply updates to the extension in their store anyway).

## [v1.10.4]

- **IMPROVED**: Performance of initial load
  - Cleaned up and simplified CSS
  - Lazy load CSS necessary for bookmark tagging and options view
  - Lazy load uFuzzy library only when fuzzy search is used
- **IMPROVED**: Bookmark tags are filtered:
  - Tags that start with a number (typical for issue / ticket bookmarks) are ignored.
  - Tag needs to be prefixed with ` #` (incl. space for separation).
- **CHANGED**: Initial load now only looks for bookmarks and only returns those matching the current URL, not starting with it
- **FIXED**: Re-apply search when switching search mode between precise and fuzzy
- **REMOVED**: Removed `tabsDisplayWindowId` option, as it didn't work very well (tab IDs are long numbers and not very helpful). This was disabled by default anyway.

## [v1.10.3]

- **FIXED**: Deleting a bookmark via popup accidentally removed all bookmarks from index (temporarily)
- **FIXED**: Disable browsers inbuilt "autocomplete" / "Saved Data" for the search input field
- **FIXED**: Fixed potential crash when browser returns empty history entries (which it shouldn't do).

## [v1.10.2]

- **FIXED**: Bookmark tagging autocomplete was partly broken. Fixed update of dependency.
- **CHANGED**: Moved the tips & tricks to markdown file and just link it, instead of random tips on startup.

## [v1.10.0]

- **NEW**: Show random tips on startup
  - Can be disabled via option `enableHelp: false`
- **NEW**: Right-click result to copy URL to clipboard
- **IMPROVED**: Improved initial loading time by caching browser history in local storage
  - The browser API to fetch history tends to be slow
  - The default history size (`historyMaxItems`) to load has been increased to 1024
- **IMPROVED**: Simplified options for calculating score of recently visited pages
  - now only `scoreRecentBonusScoreMaximum` (which defaults to +20)
- **CHORE**: Minor refactoring and cleanups, maybe with a little bit performance improvements.
- **CHORE**: Removed SCSS build step, now it's just vanilla CSS

## [v1.9.7]

- **FIXED**: Fixed missing CSS font style for tagging view

## [v1.9.6]

- **IMPROVED**: Removed Bulma CSS as dependency, instead just use [minireset.css](https://github.com/jgthms/minireset.css) for CSS reset.
- **CHORE**: Updated dependencies and moved this project to ESM (EcmaScript Modules)

## [v1.9.5]

- **FIXED**: Open result in new tab (when holding SHIFT / ALT) was not working when there are multiple browser windows
  - Reported in [#111](https://github.com/Fannon/search-bookmarks-history-and-tabs/discussions/111) and [#112](https://github.com/Fannon/search-bookmarks-history-and-tabs/issues/112)

## [v1.9.4]

- **NEW**: Added option `bookmarksIgnoreFolderList`, that excludes all bookmarks from the search that are within the listed folder(s)
  - This includes sub-folders and their bookmarks

## [v1.9.3]

- **NEW**: Search results can now also be navigated Emacs or Vim style (feature request [#106](https://github.com/Fannon/search-bookmarks-history-and-tabs/issues/106))
  - `Ctrl+N` and `Ctrl+J` for downward navigation
  - `Ctrl+P` and `Ctrl+K` for upward navigation
- **FIXED**: If `debug: true` has been set, the extension crashed on a performance measurement analysis

## [v1.9.1]

- **IMPROVED**: Better handling of long bookmark titles. Some titles are now abbreviated, especially if they are a subpart of the URL anyway.

## [v1.9.0]

- **FIXED**: Fuzzy search now also works with non-ASCII characters like CKJ chars by default
- **FIXED**: Option `bookmarkColor` now also applies to the bookmark folder badge in the search results
- **REMOVED**: Removed hybrid search as the benefits / differences against new fuzzy search are negligible.

## [v1.8.7]

- **NEW**: New option `uFuzzyOptions` that allows to configure the fuzzy search library used by this extension
  - This can be used, e.g. that fuzzy search supports CKJ characters (see README)

## [v1.8.5]

- **CHANGED**: Extension does not log or do performance measurements by default.
  - If you want to enable this, use the option: `debug: true`

## [v1.8.4]

- **NEW**: Added options to configure the color and the width of the color stripe of search results
  - `colorStripeWidth` to set the width
  - `bookmarkColor` and similar to set the color (expressed as CSS color)
- **NEW**: When hovering over an URL, the full URL is displayed as a hover. Requested via [#74](https://github.com/Fannon/search-bookmarks-history-and-tabs/issues/74)
- **IMPROVED**: Updated dependencies

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
