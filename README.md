# Browser Extension: Search Tabs, Bookmarks and History

Browser extension to search and navigate browser tabs, local bookmarks and history.
It works fully offline, so there is no external communication.
For bookmarks, it supports extraction and search of tags and folder names. 

## Features

* Local / offline only (no external communication / requests).
* Searching for open browser tabs, bookmark folder names and tags.
* Lightweight: Vanilla JS, with only a small search library ([Fuse.js](https://fuse.io/)) and a small subset of [BULMA](https://bulma.io/) CSS styles.
* Dark mode / light mode (via system settings / [prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme))

## Demo

![Demo GIF](/images/bookmark-and-history-search.gif "Demo GIF")

## Installation

### Developer Installation

The extension can only be installed locally right now, as it has not been published to the store.

* Check out this extension via git or .zip download
* Go to chrome://extensions/ 
  * Enable "Developer mode"
  * Load unpacked and open the root folder of this repository

> This extension is WIP and only for private use first.
> It is rather configurable, but you need to change the options in `popup/popup.js`

To customize the extension options, adjust the `ext.opts` in `popup/popup.js` 

## How To

* This extension can (and should!) be triggered via keyboard shortcut.
  * The default is `CTRL` + `Shift` + `.`
* Different search modes are supported
  * If you start your query with `. `: only tabs will be searched
  * If you start your query with `+ `: only history will be searched
  * If you start your query with `- `: only bookmarks will be searched
* [Fuse.js Extended Search](https://fusejs.io/examples.html#extended-search) operators can be used.
* You can tag your bookmarks by just adding `#one tag` or `#first #second` tags to it after the title.
* If you want to search for bookmark tags:
  * Start your query with `#` for fuzzy search
  * Start your query with `^#` or `'#` for more precise search
* If you want to search for bookmark folders:
  * Start your query with `>` for fuzzy search
  * Start your query with `^>` or `'>` for more precise search

## Credits

This extension makes use of the following helpful open-source projects (thanks!):
* https://bulma.io/
* https://fusejs.io/

## Ideas and To Dos

* Make extension configurable via UI (requires new `storage` permission)
* Allow to quick add & edit bookmarks (title + tags)
  * tags would ideally have autocomplete, based on existing tags (something like select2)
  * quick add current open site via + button
* Start with some initial results 
  * Remember which items have been opened recently and show last (n) items immediately?
  * Display currently open tabs?
* Try other search algorithms / libraries that are less fuzzy
  * https://github.com/nextapps-de/flexsearch 
* Create own scoring calculation
  * Different weight between index types (tabs, bookmarks, history)
  * Merge bookmarks with history, so we know when a bookmark has been opened recently / frequently -> higher score
  * Remember which result items have been executed via extension recently -> higher score
* Introduce dedicates search mode for tags and folders, that is more precise
* Convert project to TypeScript once it is published in store(s)
