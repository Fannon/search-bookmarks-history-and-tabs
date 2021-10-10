# Search Bookmarks, History and Browser Tabs

🔎 Browser extension to (fuzzy) search and navigate bookmarks, history and open tabs.

## Installation via Store

- [Chrome Extension](https://chrome.google.com/webstore/detail/tabs-bookmark-and-history/cofpegcepiccpobikjoddpmmocficdjj?hl=en-GB&authuser=0)
- [Firefox Addon](https://addons.mozilla.org/en-US/firefox/addon/search-tabs-bookmarks-history/)
- [Microsoft Edge Addon](https://microsoftedge.microsoft.com/addons/detail/search-tabs-bookmarks-an/ldmbegkendnchhjppahaadhhakgfbfpo)
- [Opera Addon](https://addons.opera.com/en/extensions/details/search-bookmarks-history-and-tabs/)

## Features

**This extension does not collect any data nor does it make any external requests** (see [Privacy](#privacy--data-protection)).

It supports two different search approaches:

- Fuzzy search (approximate string matching): Slower, but includes also inexact (fuzzy) matches.
- Exact search (starts with matching): Faster, but only exact matching results.

With this extension you can also **tag your bookmarks** including auto completions.
The tags are then considered when searching and can be used for navigation.

In general, the extension is very customizable (see [user options](#user-configuration)) and has a dark / light theme that is selected based on your system settings (see [prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme)).

For a list of recent changes, see [CHANGELOG.md](./CHANGELOG.md).

## Screenshots & Demo

![Demo Animation](/images/bookmark-and-history-search.gif 'Demo Animation')

![Screenshots](/images/bookmark-and-history-search-screenshots.png 'Screenshots')

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

## User Documentation

- This extension can (and should!) be triggered via keyboard shortcut.
  - The default is `CTRL` + `Shift` + `.`, but you can customize this.
- Just type in your search query and it will search everything.
- By default, the extension will open the selected result in a new active tab, or switch to an existing tab with the target url.
  - Hold `Shift` or `Alt` to open the result in the current tab
  - Hold `Ctrl` to open the result without closing the popup.
- In case you want to be more selective -> use a search mode:
  - Start your query with `#`: only **bookmarks with the tag** will be returned (excact "starts with" search)
  - Start your query with `~`: only **bookmarks within the folder** will be returned (excact "starts with" search)
  - Start your query with `t `: only **tabs** will be searched.
  - Start your query with `b `: only **bookmarks** will be searched.
  - Start your query with `h `: only **history** will be searched.
  - Start your query with `s `: only **search engines** will be proposed.
- Add custom bonus scores by putting ` +<whole number>` to your bookmark title (before tags)
  - Examples: `Bookmark Title +20` or `Another Bookmark +10 #tag1 #tag2`
- This extension works best if you avoid:
  - using `#` in bookmark titles that do not indicate a tag.
  - using `~` in bookmark folder names.
- Tip: You can also add special browser pages to your bookmarks, like `chrome://downloads`.

## User Configuration

The user options are written in [JSON format](https://en.wikipedia.org/wiki/JSON) or [JSON5 format](https://json5.org/).
You only need to define the options that you want to overwrite from the default.

To see what configurations are available and what they do, please have a look at the `defaultOptions` in [popup/js/model/options.js](popup/js/model/options.js).

> The options are not validated properly. Please make sure to use them correctly.<br/>
> If something breaks, consider resetting your options.

An exemplary user-config can look like the following example:

```json5
{
  general: {
    visitCounter: true, // Show number of visits counter
    dateAdded: true, // Show date added for bookmarks
  },
  searchEngines: {
    enabled: true, // Enable fallback to search engines
  },
}
```

Or a more advanced example

```json5
{
  history: {
    daysAgo: 7,
    maxItems: 1024,
    ignoreList: [
      // Ignore some localhost URLs in browser history
      'http://localhost',
      'http://127.0.0.1',
    ],
  },
  searchEngines: {
    enabled: true, // Enable fallback to search engines
    choices: [
      // Use only Google and dict.cc as fallback search engines
      {
        name: 'Google',
        urlPrefix: 'https://www.google.com/search?q=',
      },
      {
        name: 'dict.cc',
        urlPrefix: 'https://www.dict.cc/?s=',
      },
    ],
  },
  score: {
    tabBaseScore: 70, // customize base score for open tabs
  },
}
```

## Scoring System

The scoring systems works roughly the following:

- Depending on the type of result (bookmark, tab, history) a different base score is taken (e.g. `bookmarkBaseScore`).
- Depending on in which result field (title, url, tag, folder) the match was found, the search match gets weighted by multiplication. (e.g. `titleWeight`).
- This base score is now merged / multiplicated with the search library score. A less good match will usually reduce the score and a perfect / highest ranked match will keep it at .
- Depending on certain conditions some bonus score points are added on top. For example, `exactStartsWithBonus` will add score if either the title or the url start excactly with the search term, including spaces.

For a description of the scoring options and what they do, please see `defaultOptions.score` in [popup/js/options.js](popup/js/options.js).

It also helps to enable the display of the score in the result items:

```json5
{
  general: {
    score: true, // Display score for each result
  },
}
```

## Local Development

### Install and Build

Prerequisite: [Node.js](https://nodejs.org/en/)

```sh
# install dependencies
npm install

# build extension
npm run build
```

The source code for the extension can be found in [popup/](popup/) (HTML, JS and libs) and [sass/](sass/) (SCSS/CSS).

The built extensions can be found

- [dist/chrome/](dist/chrome/) for Google Chrome and Microsoft Edge
- [dist/firefox/](dist/firefox/) for Firefox
- [dist/opera/](dist/firefox/) for Opera

### Developer Installation

- Check out this extension via git
- Run `npm install` and `npm run build` (via bash / git bash)
- **For Chrome / Edge**:
  - Navigate to extensions page (`chrome://extensions/` on Chrome and `edge://extensions/` on Edge).
  - Enable "Developer mode"
  - Choose "Load unpacked" and open the root folder of this repository
- **For Firefox**:
  - First [install and build](#install-and-build) this project.
  - Load the built extension in `dist/firefox` as a temporary addon in `about:debugging`.

## Credits

This extension makes use of the following helpful open-source projects (thanks!):

- https://fusejs.io/ for the fuzzy search algorithm
- https://github.com/nextapps-de/flexsearch for the excact search algorithm
- https://github.com/yairEO/tagify for the tag autocomplete widget
- https://markjs.io/ for highlighting search matches from flexsearch
- https://www.npmjs.com/package/json5 for the user options parsing
- https://bulma.io/ for some minimal CSS base styling
- https://github.com/tabler/tabler-icons for the edit icon

## Feedback and Ideas

> Please create a [GitHub issue](https://github.com/Fannon/search-tabs-bookmarks-and-history/issues) to give your feedback.
> All ideas, suggestions or bug reports are welcome.

- Convert project to TypeScript?
