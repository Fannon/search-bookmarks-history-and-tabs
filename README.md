# Search Tabs, Bookmarks and History

Browser extension to search and navigate browser tabs, local bookmarks and history.

Bookmarks can be edited and tagged, with autocompletions.
It works fully offline (except the optional storing / syncing of user-settings), so there is no external communication on what is indexed and searched.

It is available for [Google Chrome](https://www.google.com/chrome/) and [Microsoft Edge](https://www.microsoft.com/en-us/edge) browsers.

## Features

* Quick search your open browser tabs, bookmark folder names and tags and browsing history.
* Edit and tag bookmarks with autocompletion.
* Dark theme / light theme via system settings (see [prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme))
* Customizable with user options.
* Lightweight: Written in vanilla JS with the goal to only include the minimun necessary libraries (see [credits](#credits)).

## Screenshots & Demo

![light and dark theme](/images/bookmark-and-history-search.png "light and dark theme")

![Demo GIF](/images/bookmark-and-history-search.gif "Demo GIF")

## Installation

### Stores

> 🚧 The extension will be published on the [chrome web store](https://chrome.google.com/webstore/category/extensions) and the [MS edge store](https://microsoftedge.microsoft.com/addons/Microsoft-Edge-Extensions-Home) soon.

### Developer Installation

* Check out this extension via git or download it as .zip file and unpack it
* Go to `chrome://extensions/` (chrome) or `edge://extensions/` (edge)
  * Enable "Developer mode"
  * Choose "Load unpacked" and open the root folder of the extension

## User Documentation

* This extension can (and should!) be triggered via keyboard shortcut.
  * The default is `CTRL` + `Shift` + `.`, but you can customize this.
* Just type in your search query and it will fuzzy search through everything.
* In case you want to be more selective -> use a search mode:
  * If you start your query with `. `: only tabs will be searched.
  * If you start your query with `+ `: only history will be searched.
  * If you start your query with `- `: only bookmarks will be searched.
* This extension works best if you avoid:
  * using `#` in bookmark titles that do not indicate a tag.
  * using `~` in bookmark folder names.
* [Fuse.js Extended Search](https://fusejs.io/examples.html#extended-search) operators can be used.

## User Configuration

The user options are written in [JSON format](https://en.wikipedia.org/wiki/JSON) / [JSON5 format](https://json5.org/). They do not need to be complete, as they just overwrite the default options.

To see what configurations are available and what they do, please have a look at the `defaultOptions` in [popup/src/options.js](popup/src/options.js).

If you want to customize some options, it is recommended to *only* add the actually adjusted options to your user config.

The options are not validated properly. Please make sure to use them correctly. 
If something breaks, consider resetting your options.

An exemplary user-config can look like the following example:

```json
{
  // Disable search of browsing historyf
  "history": {
    "enabled": false
  }
}
```

If you only want excact search matches, you can reduce the fuzzyness of the search:

```json
// Make search non-fuzzy
{
  "search": {
    "minMatchCharLength": 3,
    "threshold": 0
  },
  "score": {
    "minScore": 50
  }
}
```

## Scoring System

The scoring systems works roughly the following:

* Depending on the type of result (bookmark, tab, history) a different base score is taken (e.g. `bookmarkBaseScore`).
* Depending in which result field (title, url, tag, folder) the match was found, the search match gets weighted. (e.g. `titleMultiplicator`).
* This base score is now merged with the search library score (fuse.js). A less good match will reduce the score.
* Depending on certain conditions some bonus score points are added again. E.g. `exactStartsWithBonus` will add score if the title or the url starts excactly with the search term.

For a description of the scoring options and what they do, please see `defaultOptoins.score` in [popup/src/options.js](popup/src/options.js).

## Credits

This extension makes use of the following helpful open-source projects (thanks!):
* https://fusejs.io/ for the fuzzy search algorithm
* https://github.com/yairEO/tagify for the tag autocomplete widget
* https://www.npmjs.com/package/json5 for the user options parsing
* https://bulma.io/ for some minimal CSS base styling
* https://github.com/tabler/tabler-icons for the edit icon

## Feedback and Ideas Collection

> Please create a [GitHub issue](https://github.com/Fannon/search-tabs-bookmarks-and-history/issues) to give your feedback. 
> All ideas, suggestions or bug reports are welcome.

* Improve scoring algorithm?
* Introduce dedicates and precise search mode for tags and folders
* Try other search algorithms / libraries that are less fuzzy
  * https://github.com/nextapps-de/flexsearch 
* Convert project to TypeScript and make it more modular
* Quick add current open site via + button (?)
