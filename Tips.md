# Tips & Tricks

### ⌨️ Keyboard Shortcuts

- **Toggle Extension**: Default is <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>.</kbd>. You can customize this in browser extension settings.
- **Toggle Search Mode**: Press <kbd>Ctrl</kbd> + <kbd>F</kbd> to quickly switch between **Precise** and **Fuzzy** search.
- **Vim / Emacs Navigation**:
  - <kbd>Ctrl</kbd> + <kbd>N</kbd> or <kbd>Ctrl</kbd> + <kbd>J</kbd> moves selection **down**.
  - <kbd>Ctrl</kbd> + <kbd>P</kbd> or <kbd>Ctrl</kbd> + <kbd>K</kbd> moves selection **up**.
- **Open Result**:
  - <kbd>Enter</kbd>: Open in new active tab (or switch to existing tab).
  - <kbd>Shift</kbd> + <kbd>Enter</kbd> or <kbd>Alt</kbd> + <kbd>Enter</kbd>: Open in **current tab**.
  - <kbd>Ctrl</kbd> + <kbd>Enter</kbd>: Open in background without closing the popup.
- **Copy URL**: **Right-Click** any result or press a custom shortcut if configured.
- **Hybrid Search**: Press <kbd>TAB</kbd> to insert a double-space separator for combining taxonomy filters with search terms (e.g., `#tag  query`).

---

### 🔍 Advanced Searching

- **Search Modes**: Use prefixes to filter by type:
  - `#tag`: Only bookmarks with this tag.
  - `~folder`: Only bookmarks in this folder.
  - `t `: Only open tabs.
  - `b `: Only bookmarks.
  - `h `: Only history and tabs.
  - `s `: Only search engines.
- **AND Filtering**: Combine markers for precise results, e.g., `#work #todo` finds bookmarks with both tags, or `~Projects #design` finds design tags inside the Projects folder.
- **Interactive Badges**: Click on any **Tag** or **Folder** badge in the search results to instantly filter by that item.
- **Direct Navigation**: Type a domain like `example.com` or `localhost:3000` to jump directly to it.
- **Quick Aliases**: Use `g <query>` for Google, `d <query>` for dict.cc, or define your own in `customSearchEngines`.

---

### 🚀 Performance Tuning

If the extension feels slow to open or search:

- **Switch to Precise**: Precise search may be faster than Fuzzy search for large collections.
- **Limit Results**: Reduce `searchMaxResults` (default: 24) to improve rendering performance.
- **Trim History**:
  - Reduce `historyMaxItems` (default: 1024) or `historyDaysAgo` (default: 14).
  - Use `historyIgnoreList` to skip noisy sites (e.g., `localhost`, `google.com`).
  - Periodically clear your browser history; a bloated browser history database is the #1 cause of slow startup.
- **Disable Badges**: Setting `displayTags: false` or `displayFolderName: false` hides badges but keeps search working, saving rendering performance.

---

### 🛠️ Organization Tips

- **Custom Scores**: Boost important bookmarks by adding ` +20` (or any number) to the title. 
  - *Example*: `Production Dashboard +50 #work`
- **Exclusion Folders**: Use `bookmarksIgnoreFolderList` to completely hide archive or sensitive folders from search results.
- **Duplicate Detection**: Enable `detectDuplicateBookmarks: true` to see a red **D** badge on redundant bookmarks.
- **Open Tab Indicators**: A lilac **T** badge shows which bookmarks are already open in a tab.

---

### ⚙️ More Customization

This extension is highly configurable via YAML or JSON. 
For a full list of settings and their descriptions, see:

👉 **[OPTIONS.md](https://github.com/Fannon/search-bookmarks-history-and-tabs/blob/main/OPTIONS.md)**
