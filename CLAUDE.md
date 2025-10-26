# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a browser extension (Chrome, Firefox, Edge) that provides fuzzy/precise search across bookmarks, browser history, and open tabs. The extension is privacy-focused with no external communication, no background processing, and no data storage except user settings.

## Essential Commands

### Development Workflow

```bash
npm install                    # Install dependencies
npm run build                  # Full production build (clean → bundle → manifests → dist → size report)
npm run watch                  # Auto-rebuild on changes (use during development)
npm run start                  # Serve popup with mock data at http://localhost:8080
npm run start:dist             # Serve built extension from dist/chrome/popup/
```

### Testing

```bash
npm run lint                   # ESLint validation; start every verify loop here
npm run test                   # Jest unit tests (alias of test:unit, supports extra args: npm run test path/to/file.test.js)
npm run test:unit <file>.test.js              # Run specific unit test (identical to npm run test with file)
npm run test:unit:coverage <file>.test.js     # Run with coverage report
npm run test:e2e               # Playwright end-to-end tests (chromium only)
npm run test:e2e -- tests/<file>.spec.js      # Run specific e2e test file
npm run test:e2e:chromium      # Playwright for Chromium only
npm run test:e2e:firefox       # Playwright for Firefox only
```

### Recommended Verify Loop

1. `npm run lint`
2. `npm run test <path/to/file.test.js>` (iterate on focused Jest specs)
3. `npm run test:e2e`
4. If the e2e suite fails, rerun the specific spec via `npm run test:e2e -- tests/<file>.spec.js`

### Build Components

```bash
npm run clean                  # Remove build artifacts
npm run build:bundle           # Bundle JavaScript with esbuild
npm run build:update-libs      # Update vendored third-party libraries
npm run build:update-manifests # Sync manifest.json files
npm run build:create-dist      # Package for browser stores
npm run size                   # Report bundle sizes
npm run analyze                # Code analysis diagnostics
```

## Architecture

### Module Organization

The repository centers on the `popup/` source:

- **`popup/css/`** - Stylesheets for popup views.
- **`popup/img/`** - UI imagery used by the popup.
- **`popup/mockData/`** - Fixtures that back the local `npm run start` server.
- **`popup/js/`** - Entry points and shared logic for every popup page (details below). Each `init*.js` file is bundled into a `.bundle.min.js` artifact; never edit the generated bundles directly.

Supporting directories:

- **`popup/lib/`** - Vendored third-party scripts/styles updated via `bin/updateLibs.js`.
- **`images/`** - Marketing assets (GIFs, screenshots) referenced in docs.
- **`playwright/tests/`** - Playwright end-to-end specs.
- **`bin/`** - Automation scripts wired to `package.json` commands.
- **`dist/`** - Built artifacts grouped by browser target (e.g. `dist/chrome/...`).
- **`playwright-report/`** and **`reports/`** - Local HTML/JSON test output captured by CI and manual runs.

Within `popup/js/`, the codebase follows a strict separation of concerns:

- **`popup/js/helper/`** - Pure utility functions (DOM manipulation, browser API wrappers, time formatting)
- **`popup/js/model/`** - Data structures and configuration (search data aggregation, options management)
- **`popup/js/search/`** - Search orchestration and algorithms
  - `common.js` - Query parsing, search mode detection, result rendering orchestration
  - `simpleSearch.js` - Precise (exact-match) search algorithm
  - `fuzzySearch.js` - Fuzzy (approximate-match) search with uFuzzy library
  - `taxonomySearch.js` - Tag (#) and folder (~) filtering with AND logic
  - `scoring.js` - Result relevance scoring algorithm (5-step process)
- **`popup/js/view/`** - UI rendering and DOM updates (search results, tags, folders, bookmarks editor)

### Entry Points

The extension has multiple HTML pages with corresponding JavaScript entry points:

- **`popup/index.html`** → `popup/js/initSearch.js` - Main search interface
- **`popup/tags.html`** → `popup/js/initTags.js` - Tags overview
- **`popup/folders.html`** → `popup/js/initFolders.js` - Folders overview
- **`popup/editBookmark.html`** → `popup/js/initEditBookmark.js` - Bookmark editor
- **`popup/options.html`** → `popup/js/initOptions.js` - Settings page

Each init script is bundled into a `.bundle.min.js` file via `bin/bundle.js` using esbuild.

### Extension Context

The global `ext` object (created in `popup/js/helper/extensionContext.js`) serves as the application state container:

```javascript
ext.opts // Effective user options (merged with defaults)
ext.model // Search data: bookmarks, tabs, history, searchMode
ext.dom // Cached DOM element references
ext.initialized // Initialization status flag
ext.searchCache // Map for caching search results
```

### Search Flow

1. **Initialization** (`initSearch.js:initExtension`)

   - Load user options from browser storage (YAML/JSON)
   - Fetch bookmarks, tabs, and history via browser APIs
   - Merge history data into bookmarks/tabs (lazy evaluation)
   - Setup event listeners and debounced search

2. **Query Parsing** (`search/common.js:search`)

   - Detect search mode prefixes: `h ` (history), `b ` (bookmarks), `t ` (tabs), `s ` (search engines)
   - Detect taxonomy markers: `#` (tags), `~` (folders)
   - Check for custom search engine aliases (e.g., `g ` for Google)
   - Detect direct URL navigation

3. **Search Execution**

   - **Precise search** (`search/simpleSearch.js`) - Case-insensitive exact matching, faster
   - **Fuzzy search** (`search/fuzzySearch.js`) - Uses uFuzzy library for approximate matching
   - **Taxonomy search** (`search/taxonomySearch.js`) - Dedicated tag/folder filtering with AND logic

4. **Scoring System** (`search/scoring.js:calculateFinalScore`)

   - See [popup/js/search/scoring.js](popup/js/search/scoring.js) for comprehensive algorithm documentation

5. **Rendering** (`view/searchView.js:renderSearchResults`)
   - Sort by final score
   - Limit to `searchMaxResults`
   - Highlight matches with mark.js (lazy loaded)
   - Display color-coded result type indicators

### Browser API Integration

All browser API calls are abstracted through `popup/js/helper/browserApi.js`:

- `getBrowserBookmarks()` - Recursively fetches bookmark tree
- `getBrowserTabs()` - Gets all open tabs across windows
- `getBrowserHistory()` - Fetches history items (limited by `historyMaxItems` and `historyDaysAgo`)
- Conversion functions transform browser data into normalized search entries

The extension handles both real browser environments and mock data for local development.

### User Configuration

User options are defined in `popup/js/model/options.js` (`defaultOptions` object). Users can override settings via YAML/JSON in the options page. Key configuration areas:

- **Search behavior**: `searchStrategy` (precise/fuzzy), `searchMaxResults`, `searchFuzzyness`
- **Data sources**: `enableBookmarks`, `enableTabs`, `enableHistory`, `historyMaxItems`
- **Performance**: `searchDebounceMs`, `displaySearchMatchHighlight`, `searchMinMatchCharLength`
- **Scoring**: `scoreBookmarkBase`, `scoreTitleWeight`, `exactStartsWithBonus`, etc.
- **Custom search engines**: `customSearchEngines` array with alias/URL patterns

### Bookmark Tagging System

Bookmarks can be tagged using `#tag` syntax in titles:

- Tags are extracted from bookmark titles via regex (`popup/js/helper/browserApi.js`)
- Tags cannot start with numbers (filters out issue numbers)
- Tag autocomplete uses Tagify library (`popup/lib/tagify.min.js`)
- Custom scores can be added: `Bookmark Title +20 #tag1 #tag2`

## Key Technical Constraints

- **ESM modules**: All source uses ES modules, Jest runs with `--experimental-vm-modules`
- **No build step for local dev**: Source can be served directly at `popup/` for rapid testing
- **Vendored dependencies**: Third-party libraries in `popup/lib/` are updated via `bin/updateLibs.js`
- **Browser compatibility**: Manifest V3 for Chrome/Edge, separate Firefox manifest
- **No TypeScript**: Vanilla JavaScript throughout
- **Minimal dependencies**: Prefers lightweight implementations over heavy frameworks

## Testing Strategy

- **Unit tests**: Jest with jsdom, co-located in `__tests__/` directories
- **E2E tests**: Playwright specs in `playwright/tests/` cover full user workflows
- Tests must be deterministic, isolated, and avoid external dependencies
- Mock browser APIs when testing in Node environment

## Code Style

Enforced by `eslint.config.mjs`:

- 2-space indentation
- Single quotes
- No trailing semicolons
- Modern ESM syntax
- Prefer explicit exports over defaults

## Build System

Build scripts in `bin/` are small Node.js programs:

- **`bundle.js`** - esbuild bundler for entry points
- **`updateManifests.js`** - Syncs version/permissions across browser manifests
- **`createDist.js`** - Creates ZIP archives for store submission
- **`watch.js`** - File watcher for development
- **`size.js`** - Reports bundle sizes after build

## Common Pitfalls

- **Always run the verify loop before committing**: `npm run lint`, iterate with `npm run test <file>` for focused Jest runs, then finish with `npm run test:e2e`
- **Watch mode for extension development**: Keep `npm run watch` running when testing sideloaded extension
- **Cache invalidation**: Search results are cached; clear cache when changing scoring logic
- **Manifest permissions**: Update via `npm run build:update-manifests` when changing browser APIs
- **Mock data path**: Local dev mode expects `popup/mockData/chrome.json`
- **Tags vs folders**: Use `#` for tags (exact match), `~` for folders (path prefix match)
- **Scoring logic changes**: When modifying score calculations in `popup/js/search/scoring.js`, ensure `calculateFinalScore` tests in `popup/js/search/__tests__/calculateFinalScore.test.js` still pass. Field normalization (case-insensitive, URL handling) is crucial for consistency.

## Performance Considerations

- **History API is slow**: Limit `historyMaxItems` (default: 1024) and `historyDaysAgo` for better performance
- **Fuzzy search overhead**: Precise search is significantly faster than fuzzy
- **Lazy history merging**: History data is only merged when matches exist
- **Search debouncing**: `searchDebounceMs` prevents excessive search calls
- **Result caching**: Cache key includes search term, strategy, and mode
- **Highlight on demand**: mark.js is lazy-loaded after initialization

## Related Documentation

- **AGENTS.md** - Detailed coding conventions, commit guidelines, testing protocols
- **CONTRIBUTING.md** - Local development setup, PR workflow
- **README.md** - User documentation, feature overview, privacy policy
- **.github/copilot-instructions.md** - Quick orientation for AI agents
