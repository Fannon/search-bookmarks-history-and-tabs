# Search Tabs, Bookmarks and History

Browser extension to search and navigate browser tabs, local bookmarks and history.

It is available for [Google Chrome](https://www.google.com/chrome/) and [Microsoft Edge](https://www.microsoft.com/en-us/edge) browsers.
Bookmarks can be edited and tagged, with autocompletions.
It works fully offline (except the optional storing / syncing of user-settings), so there is no external communication on what is indexed and searched.

## Features

* Search for open browser tabs, bookmark folder names and tags and browsing history.
* Edit and tag bookmarks with autocompletion for tags.
* Dark mode / light mode (via system settings / [prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme))
* Can be customized via user options.
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

> If you want to fine-tune the extension, check out `ext.opts` in `popup/popup.js`

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

Currently the user options can only be written in [JSON format](https://en.wikipedia.org/wiki/JSON). They do not need to be complete, as they just overwrite the default options.

To see what configurations are available and what they do, please have a look at the `defaultOptions` in [popup/src/options.js](popup/src/options.js).

If you want to customize some options, it is recommended to *only* add the actually adjusted options to your user config.

An exemplary user-config can look like the following example:

```json
{
  "general": {
    "visitCounter": false
  },
  "search": {},
  "tabs": {},
  "bookmarks": {},
  "history": {
    "enabled": false
  }
}
```

## Credits

This extension makes use of the following helpful open-source projects (thanks!):
* https://fusejs.io/ for the fuzzy search algorithm
* https://github.com/yairEO/tagify for the tag autocomplete widget
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
