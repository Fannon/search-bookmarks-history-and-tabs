# Search Bookmarks, History and Browser Tabs

> 🔎 Browser extension to (fuzzy) search and navigate bookmarks, history and open tabs.

## Installation via Store

- [Chrome Extension](https://chrome.google.com/webstore/detail/tabs-bookmark-and-history/cofpegcepiccpobikjoddpmmocficdjj?hl=en-GB&authuser=0)
- [Firefox Addon](https://addons.mozilla.org/en-US/firefox/addon/search-tabs-bookmarks-history/)
- [Microsoft Edge Addon](https://microsoftedge.microsoft.com/addons/detail/search-tabs-bookmarks-an/ldmbegkendnchhjppahaadhhakgfbfpo)

## Features

- Quick search your browser bookmarks, history and open tabs.
- The extension does not collect any data nor does it make any external requests.
- Supports two different search approaches:
  - Fuzzy search (approximate string matching): Slower, but includes also inexact (fuzzy) matches.
  - Exact search (starts with matching): Faster and only exact matching results.
- Bookmarks can be searched for tags (extracted from title) and folder names.
- Edit and tag bookmarks with auto complete on tags.
- Dark theme / light theme via system settings (see [prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme))
- Fallback to use search engines like google, dict.cc etc. (multiple options)
- Customization via [user options](#user-configuration).
- Lightweight: Written in vanilla JavaScript with the goal to only include only [a few necessary libraries](#credits).

## Screenshots & Demo

![Demo Animation](/images/bookmark-and-history-search.gif "Demo Animation")

![Screenshots](/images/bookmark-and-history-search-screenshots.png "Screenshots")

## User Documentation

- This extension can (and should!) be triggered via keyboard shortcut.
  - The default is `CTRL` + `Shift` + `.`, but you can customize this.
- Just type in your search query and it will search everything.
- In case you want to be more selective -> use a search mode:
  - Start your query with `#`: only **bookmarks with the tag** will be returned (excact "starts with" search)
  - Start your query with `~`: only **bookmarks within the folder** will be returned (excact "starts with" search)
  - Start your query with `t `: only **tabs** will be searched.
  - Start your query with `b `: only **bookmarks** will be searched.
  - Start your query with `h `: only **history** will be searched.
  - Start your query with `s `: only **search engines** will be proposed.
- This extension works best if you avoid:
  - using `#` in bookmark titles that do not indicate a tag.
  - using `~` in bookmark folder names.
- TIPP: You can also add special browser pages to your bookmarks, like `chrome://downloads`.

## User Configuration

The user options are written in [JSON format](https://en.wikipedia.org/wiki/JSON) or [JSON5 format](https://json5.org/). You only need to define the options that you want to overwrite options.

To see what configurations are available and what they do, please have a look at the `defaultOptions` in [popup/js/model/options.js](popup/js/model/options.js).

> The options are not validated properly. Please make sure to use them correctly.<br/>
> If something breaks, consider resetting your options.

An exemplary user-config can look like the following example:

```json5
{
  history: {
    ignoreList: [
      // Ignore some localhost URLs in browser history
      "http://localhost",
      "http://127.0.0.1",
    ],
  },
  searchEngines: {
    choices: [
      // Use only DuckDuckGo and dict.cc as fallback search engines
      {
        name: "DuckDuckGo",
        urlPrefix: "https://duckduckgo.com/?q=",
      },
      {
        name: "dict.cc",
        urlPrefix: "https://www.dict.cc/?s=",
      },
    ],
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

The built extensions can be found in [dist/chrome/](dist/chrome/) for Google Chrome and Microsoft Edge and [dist/firefox/](dist/firefox/) for Firefox.

### Developer Installation

- Check out this extension via git or download it as .zip file and unpack it
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
