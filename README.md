# Browser Extension: Search Tabs, Bookmarks and History

Browser extension to search and navigate browser tabs, local bookmarks and history.

Bookmarks can be edited and tagged, with autocompletions.
It works fully offline, so there is no external communication.

## Features

* Local / offline only (no external communication / requests).
* Searching for open browser tabs, bookmark folder names and tags.
* Dark mode / light mode (via system settings / [prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme))
* Bookmark editing and tagging capability (with autocompletion)
* Lightweight: Written in vanilla JS with the goal to only include the minimun necessary libraries (see [credits](#credits)).

## Demo

![light and dark theme](/images/bookmark-and-history-search.png "light and dark theme")

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
* https://fusejs.io/ for the fuzzy search algorithm
* https://github.com/yairEO/tagify for the tag autocomplete widget
* https://bulma.io/ for some minimal CSS base styling
* https://github.com/tabler/tabler-icons for the edit icon

## Ideas and To Dos

* Quick add current open site via + button
* Make extension configurable via UI (requires new `storage` permission)
* Include inline help how extension is used
* Improve scoring algorithm?
* Introduce dedicates and precise search mode for tags and folders
* Try other search algorithms / libraries that are less fuzzy
  * https://github.com/nextapps-de/flexsearch 
* Convert project to TypeScript and make it more modular
