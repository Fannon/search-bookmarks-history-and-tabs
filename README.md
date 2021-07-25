# search-bookmarks-and-history
Chrome Extension to fuzzy search bookmarks and history.

## Installation

The extension can only be installed locally right now, as it has not been published to the store.

* Check out this extension via git or .zip download
* Go to chrome://extensions/ 
  * Load unpacked and open the root folder of this repository

> This extension is WIP and only for private use first.
> It is rather configurable, but you need to change the options in `popup/popup.js`

## Screenshots and Demo

![Screenshot](/images/screenshot.png "Screenshot")

## Tipps & Tricks
* This extension can (and should!) be triggered via keyboard shortcut.
  * The default is `CTRL` + `.`
* You can tag your bookmarks by just adding `#one tag` or `#first #second` tags to it after the title.
* If you want to search for bookmark tags, start your query with `#`
* If you want to search for bookmark folders, start with `>`

## Ideas and To Dos
* Make extension configurable via UI
* Add a Dark Theme
* Allow to quick edit bookmark title (e.g. to add tags)?
* Try other search approaches / libraries
  * https://github.com/nextapps-de/flexsearch 
