# Copilot Instructions for AI Coding Agents

## Project Overview

- This is a browser extension for searching and navigating bookmarks, history, and open tabs with fuzzy and exact search modes.
- Main source code is in `popup/` (HTML, CSS, JS, and libraries). Core logic is in `popup/js/`.
- User configuration is managed via YAML/JSON, with defaults in `popup/js/model/options.js` (`defaultOptions`).
- No external data collection or background jobs; all data is local and ephemeral except user settings.

## Architecture & Data Flow

- Search logic is split into `simpleSearch.js`, `fuzzySearch.js`, and `taxonomySearch.js` under `popup/js/search/`.
- Views are managed in `popup/js/view/` (e.g., `searchView.js`, `tagsView.js`, `foldersView.js`).
- Data models for bookmarks, history, tabs, and options are in `popup/js/model/`.
- Helper functions and browser API wrappers are in `popup/js/helper/`.
- Scoring and result ranking are configurable; see `options.js` for weights and bonuses.
- Tagging and folder navigation are first-class features; search modes are triggered by query prefixes (see README for details).

## Developer Workflows

- **Build:** `npm run build` (output in `dist/`)
- **Start (mock data):** `npm run start`
- **Test (Cypress):** `npm run test` (tests in `cypress/e2e/`)
- **Install:** `npm install` (Node.js required)
- **Manual browser install:** Load unpacked extension from repo root (Chrome/Edge) or `dist/firefox` (Firefox)
- **Scripts:** Additional scripts in `bin/` for cleaning, updating libs/manifests

## Project-Specific Patterns & Conventions

- User options are not strictly validated; handle with care
- No background processing; all logic runs in popup context
- Fuzzy search uses [uFuzzy](https://github.com/leeoniya/uFuzzy); options can be tuned via config
- Tag autocomplete uses [tagify](https://github.com/yairEO/tagify)
- Search result highlighting uses [mark.js](https://markjs.io/)

## Integration Points

- Browser APIs: bookmarks, history, tabs, storage
- External libraries: see `popup/lib/` for bundled dependencies
- End-to-end tests: Cypress (`cypress/e2e/`)

## Key Files & Directories

- `popup/js/model/options.js`: User config defaults and descriptions
- `popup/js/search/`: Search logic (simple, fuzzy, taxonomy)
- `popup/js/view/`: UI views
- `popup/js/helper/`: Utility functions and browser API wrappers
- `cypress/e2e/`: End-to-end tests
- `bin/`: Maintenance scripts
- `README.md`: User and developer documentation

## Example: Adding a Search Mode

- Update query parsing logic in `popup/js/search/common.js`
- Add mode handling in relevant search files (e.g., `simpleSearch.js`, `fuzzySearch.js`)
- Document new mode in `README.md` and `options.js` if user-configurable

---

If any section is unclear or missing important project-specific details, please provide feedback so this guide can be improved.
