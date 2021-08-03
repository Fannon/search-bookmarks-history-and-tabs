# Search Tabs, Bookmarks and History

Browser extension to (fuzzy) search and navigate browser tabs, local bookmarks and history.

Bookmarks can be edited and tagged, with autocomplete.
Tags and bookmark folders can be browsed and searched.
The extension works fully local and makes no external requests (except storing / syncing optional user options).

It works with [Google Chrome](https://www.google.com/chrome/), [Microsoft Edge](https://www.microsoft.com/en-us/edge) and also on [Firefox](https://www.mozilla.org/en-US/firefox/new/). 

## Features

* Quick search your open browser tabs, bookmark and browsing history.
* Bookmarks are also searched for tags (extracted from title) and folder names.
* Edit and tag bookmarks with autocompletion.
* Dark theme / light theme via system settings (see [prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme))
* Customizable via user options.
* Lightweight: Written in vanilla JS with the goal to only include the minimun necessary libraries (see [credits](#credits)).

## Screenshots & Demo

![light and dark theme](/images/bookmark-and-history-search-screenshots.png "light and dark theme")

![Demo GIF](/images/bookmark-and-history-search.gif "Demo GIF")

## Installation

### Stores

> 🚧 The extension will be published on the [chrome web store](https://chrome.google.com/webstore/category/extensions) and the [MS edge store](https://microsoftedge.microsoft.com/addons/Microsoft-Edge-Extensions-Home) soon.

### Developer Installation

* Check out this extension via git or download it as .zip file and unpack it
* Go to `chrome://extensions/` (chrome) or `edge://extensions/` (edge)
  * Enable "Developer mode"
  * Choose "Load unpacked" and open the root folder of the extension
* For Firefox, you first need to `npm install` and `npm build` this project (see [Local Development](#local-development)). Now you can load the built extension in `dist/firefox` as a temporary addon in `about:debugging`.

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

The user options are written in [JSON format](https://en.wikipedia.org/wiki/JSON) or [JSON5 format](https://json5.org/). They do not need to be complete, as they just overwrite the default options.

To see what configurations are available and what they do, please have a look at the `defaultOptions` in [popup/js/options.js](popup/js/options.js).

If you want to customize some options, it is recommended to *only* add the actually adjusted options to your user config.

The options are not validated properly. Please make sure to use them correctly. 
If something breaks, consider resetting your options.

An exemplary user-config can look like the following example:

```json5
// Disable search of browsing history
{
  "history": {
    "enabled": false
  }
}
```

If you only want excact search matches, you can reduce the fuzzyness of the search:

```json5
// Make search non-fuzzy
{
  "search": {
    "minMatchCharLength": 3,
    "fuzzyness": 0
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

For a description of the scoring options and what they do, please see `defaultOptoins.score` in [popup/js/options.js](popup/js/options.js).

It also helps to enable displaying the score in the result items

```json5
// Display score for each result
{
  "general": {
    "score": true
  }
}
```

## Local Development

Prerequisite: [Node.js](https://nodejs.org/en/)

```sh
# install dependencies
npm install

# build extension
npm run build
```

The source code for the extension can be found in [popup/](popup/) (HTML, JS and libs) and [sass/](sass/) (SCSS/CSS).

The built extensions can be found in [dist/chrome/](dist/chrome/) for Google Chrome and Microsoft Edge and [dist/firefox/](dist/firefox/) for Firefox.

## Credits

This extension makes use of the following helpful open-source projects (thanks!):
* https://fusejs.io/ for the fuzzy search algorithm
* https://github.com/yairEO/tagify for the tag autocomplete widget
* https://www.npmjs.com/package/json5 for the user options parsing
* https://bulma.io/ for some minimal CSS base styling
* https://github.com/tabler/tabler-icons for the edit icon

## Feedback and Ideas

> Please create a [GitHub issue](https://github.com/Fannon/search-tabs-bookmarks-and-history/issues) to give your feedback. 
> All ideas, suggestions or bug reports are welcome.

* Introduce dedicates and precise search mode for tags and folders
* Add alternative search algorithms that aren't based on fuzzy search?
  * https://github.com/nextapps-de/flexsearch 
  * https://lunrjs.com/
* Improve performance or introduce debouncing / throttling searches 
* Convert project to TypeScript, refactor code and make it more modular
