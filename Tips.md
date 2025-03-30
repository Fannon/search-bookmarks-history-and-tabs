# Tips & Tricks

**Customization**: This extension can be customized via options in many ways. Please refer to the [User Documentation](https://github.com/Fannon/search-bookmarks-history-and-tabs/tree/main?tab=readme-ov-file#user-documentation).

**Keyboard Shortcut**: Trigger the extension via keyboard.
The default is `CTRL` + `Shift` + `.`

This can be customized in the browsers [extensions settings](chrome://extensions/) > "Keyboard Shortcuts".

<hr/>

**Search Strategies**: Switch between <span class="precise">PRECISE</span> (faster, exact) and <span class="fuzzy">FUZZY</span> (slower, more results, fuzzy).

This can be done via clicking on the top-right corner of the popup or by setting it in the options like: `searchStrategy: precise`

<hr/>

**Search Modes**: Use search modes to be more selective.

Start your search query with a search mode prefix:

- `#`: Only **bookmarks with the tag** will be returned
- `~`: Only **bookmarks within the folder** will be returned
- `t `: Only **tabs** will be searched.
- `b `: Only **bookmarks** will be searched.
- `h `: Only **history** and **tabs** will be searched.
- `s `: Only **search engines** will be proposed.
</ul>

<hr/>

**Performance**: If you run into performance issues, consider:

- Improve initialize performance:
  - Clean your browser history from time to time (the history database in browsers tends to get slow, much of the extensions loading time is caused by slow history database access)
  - Reduce history size (see below)
- Improve search performance:
  - Switch to precise search strategy instead of fuzzy
  - Set option: `searchMinMatchCharLength: 2` (or more) to start searching only when the search string is at least 2 characters long
  - Reduce option `searchMaxResults` from 32 to something lower

<hr/>

**History Size & History**: By default the number of history items to load are limited.
Consider increasing or decreasing this, depending on your performance situation and personal preferences:

- Add / adjust option: `historyMaxItems: 1024`
- Add / adjust option: `historyDaysAgo: 14`

<hr/>

**Open selected results**: By default, the extension will open the selected result in a new tab or switch to an existing tab if fitting.

- Hold `Shift` or `Alt` to open the result in the current tab.
- Hold `Ctrl` to open the result without closing the popup.
- Press `Right Click` to copy URL of result into clipboard without closing the popup.

<hr/>

**Custom Bonus Scores**: Append ` + [whole number]` to your bookmark title (before tags).

- Example: `Another Bookmark +10 #tag1`

<hr/>

**Copy to Clipboard**: Right click a result item to copy its URL to the clipboard.

<hr/>

**Special Browser Pages**: You can add special browser pages to your bookmarks, like
[chrome://downloads](chrome://downloads).

<hr/>

**Clean Up History**: There is an option to ignore URLs from history if they include a string.
Use this to remove unwanted entries from your history from your search index.

```yaml
historyIgnoreList:
  - extension://
  - http://localhost
  - http://127.0.0.1
```

<hr/>

**Keyboard Navigation**: You can navigate result entries also in Emacs / Vim style:

- `Ctrl+N` and `Ctrl+J` to navigate search results up.
- `Ctrl+P`and`Ctrl+K` to navigate search results down.
