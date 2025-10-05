# Codebase Orientation

This document gives newcomers a guided tour through the extension's structure, explains how the main pieces interact, and points to good next steps for deeper learning.

## High-level architecture

The project is a cross-browser extension that exposes its UI entirely through the popup specified in the Manifest V3 descriptor. The manifest declares the extension metadata, permissions for reading tabs/bookmarks/history, and points the browser action to `popup/index.html`, making the popup the application's entry point.【F:manifest.json†L1-L32】

Build and packaging tasks live under `bin/` and are orchestrated by the npm scripts in `package.json`. Typical workflows include cleaning previous builds, refreshing manifests, copying assets into `dist/`, and zipping the packaged Chrome artifact for store upload.【F:package.json†L1-L47】【F:bin/createDist.sh†L1-L34】

## Popup application layout

All runtime logic resides in `popup/`, which follows an MVC-inspired split:

- `popup/js/helper/` exposes browser API wrappers and shared utilities used across modules.
- `popup/js/model/` manages data loading and configuration (options, bookmark/history indexes).
- `popup/js/search/` implements the actual search strategies and result scoring.
- `popup/js/view/` renders UI fragments and handles DOM-driven interactions.
- `popup/js/initSearch.js` wires everything together, bootstrapping the popup when it opens.【F:popup/js/initSearch.js†L1-L114】

Static assets and markup for the popup live alongside the scripts in `popup/index.html`, `popup/css/`, and `images/`.

### Initialization flow

`initSearch.js` exports a singleton `ext` namespace that stores options, data models, search indexes, and cached DOM elements. When the popup loads, `initExtension()` fetches the effective options, hydrates DOM references, loads bookmarks/tabs/history via the model layer, registers UI event listeners, and triggers an initial render of default entries.【F:popup/js/initSearch.js†L1-L106】

Routing is handled by monitoring `window.location.hash` values. Dedicated handlers switch between search, tags, folders, and bookmark editing views by updating the hash and delegating to the appropriate view modules.【F:popup/js/initSearch.js†L108-L163】

### Options and configuration

`popup/js/model/options.js` defines a comprehensive `defaultOptions` object that controls behaviour such as search strategy, scoring thresholds, UI badges, and which data sources to index. Users override these defaults through synced options stored via the browser storage API; helper functions in the same module load and merge the settings at startup.【F:popup/js/model/options.js†L1-L120】【F:popup/js/model/options.js†L198-L257】

Understanding the available options is essential because many features (tags, folder overviews, fuzzy search, etc.) gate themselves on specific flags.

### Search pipeline

All key search interactions flow through `popup/js/search/common.js`:

1. Normalize the query and detect special prefixes that scope the search to history, bookmarks, tabs, tags, or folders.
2. Delegate to either precise or fuzzy search implementations depending on `ext.opts.searchStrategy`.
3. Optionally append direct-URL shortcuts and configured search engine suggestions.
4. Score and sort aggregated results before handing them to the view layer for rendering.【F:popup/js/search/common.js†L1-L130】【F:popup/js/search/common.js†L178-L221】

Precise search is implemented in `simpleSearch.js` while fuzzy search uses the `@leeoniya/ufuzzy` library. Both produce normalized result objects that include metadata for the view.

### Rendering and interaction

`popup/js/view/searchView.js` converts the computed result list into DOM nodes. It applies styling based on option-controlled colour schemes, displays metadata badges (tags, folders, visit counts), and wires mouse/keyboard handlers for navigating the list or opening entries. The view also handles mark.js integration for highlighted search snippets when enabled.【F:popup/js/view/searchView.js†L1-L140】【F:popup/js/view/searchView.js†L142-L211】

Other view modules power auxiliary screens such as tag and folder overviews or the bookmark editor. They rely on shared helpers for formatting (e.g., `timeSince`) and update the hash router to swap between overlays.

## Testing and quality tooling

Two testing layers are available:

- **Cypress** end-to-end flows live under `cypress/e2e/`. Tests rely on `npm run start` (served via `live-server`) and exercise popup behaviours like searching, tag navigation, and options editing.【F:cypress.config.mjs†L1-L13】【F:cypress/e2e/search.cy.js†L1-L40】
- **Jest** unit tests belong alongside source files in `__tests__` directories. `npm run test:unit` bootstraps Jest with the jsdom environment defined in `jest.config.js` for DOM-aware helpers.【F:package.json†L28-L43】

ESLint enforces consistent formatting across `popup/js/` via the `npm run lint` script. Refer to `eslint.config.mjs` for rule specifics.

## Suggested learning path

1. **Run the popup locally** using `npm install`, `npm run start`, and explore the UI. Watching the console with `debug` mode enabled provides insight into indexing and performance markers.【F:popup/js/initSearch.js†L40-L99】
2. **Experiment with options** by editing `defaultOptions` or providing overrides; observe how toggles affect the search pipeline and rendering.【F:popup/js/model/options.js†L1-L257】
3. **Trace a search request** from `searchView.js` (input events) to `search/common.js` and onward into the search algorithms to learn how results are aggregated.【F:popup/js/search/common.js†L1-L130】【F:popup/js/view/searchView.js†L1-L62】
4. **Inspect and extend tests** in `cypress/e2e/` or write targeted Jest specs near the helpers you modify.【F:cypress/e2e/search.cy.js†L1-L40】
5. **Review build scripts** under `bin/` and the release process in `package.json` to understand how the extension is packaged for different browsers.【F:bin/createDist.sh†L1-L34】【F:package.json†L1-L47】

With these pieces in mind, you should be able to navigate the codebase confidently, make targeted fixes, and extend search behaviour while keeping UI feedback aligned with the existing conventions.
