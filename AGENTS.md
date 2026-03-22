# AGENTS.md

## Project rules

- Browser extension popup only: no background worker, no network or telemetry, stateless except for user options.
- Search must stay instant on large datasets. Avoid unnecessary DOM work and allocations in hot paths.
- Keep the extension small. Avoid unnecessary code, duplicated logic, and new dependencies that increase bundle size.
- Use ESM and vanilla JS only. Follow Biome formatting: 2 spaces, single quotes, no semicolons.
- Prefer small, focused diffs. Do not add dependencies without approval.

## Structure

- Search entry points: `popup/js/initSearch.js`, `popup/js/initOptions.js`, `popup/js/initTags.js`, `popup/js/initFolders.js`, `popup/js/initGroups.js`, `popup/js/initEditBookmark.js`
- Search orchestration and strategies: `popup/js/search/common.js`, `popup/js/search/simpleSearch.js`, `popup/js/search/fuzzySearch.js`, `popup/js/search/taxonomySearch.js`
- Query parsing, ranking, defaults: `popup/js/search/queryParser.js`, `popup/js/search/scoring.js`, `popup/js/search/defaultResults.js`, `popup/js/search/searchEngines.js`
- Data and options: `popup/js/model/searchData.js`, `popup/js/model/options.js`, `popup/js/model/validateOptions.js`
- Browser wrappers and helpers: `popup/js/helper/browserApi.js`, `popup/js/helper/utils.js`, `popup/js/helper/extensionContext.js`
- Rendering: `popup/js/view/*`
- Shared styles: `popup/css/style.css`

## Search and performance

- Pre-normalize searchable fields during init.
- Precompute highlight markup as strings; avoid DOM-based highlighting during search.
- Avoid object spread and repeated regex compilation in hot loops.
- Filter and slice before expensive ranking or rendering work.
- Test both precise and fuzzy paths when changing search behavior.
- Validate perf-sensitive changes against large datasets.

## Error handling

- Browser API failures: `console.warn` and return empty results.
- Options failures: fall back to defaults and call `printError`.
- Search and render failures: show the dismissible overlay via `printError`; do not crash the popup.

## Commands

- Prefer targeted checks first:
  - `npx @biomejs/biome check path/to/file.js`
  - `npm run test:unit -- path/to/test.js`
- Typical loop: `npm run lint` then relevant unit tests.
- Run `npm run test:e2e` for UI or behavior changes.
- Run `npm run test:perf` for search, scoring, render, or cache changes.
- Run `npm run size` when changing dependencies, bundling, shared utilities, or adding significant new code.
- Run `npm run build` only when explicitly requested or for release-oriented work.

## Ask first

- package installs
- deleting or renaming many files
- broad refactors outside the requested area
- expensive full-suite runs when targeted checks are sufficient

## Examples

- Query parsing: `popup/js/search/queryParser.js`
- Ranking: `popup/js/search/scoring.js`
- Search rendering: `popup/js/view/searchView.js`
- Error overlay: `popup/js/view/errorView.js`
- Options loading and validation: `popup/js/model/options.js`, `popup/js/model/validateOptions.js`

## When stuck

- Ask a clarifying question or propose a short plan instead of making speculative large changes.
