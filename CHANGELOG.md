# CHANGELOG

## v1.2.0

- NEW: Results can now be opened in current tab or background tab
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
