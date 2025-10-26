# Repository Guidelines

## Project Structure & Module Organization

- The popup source lives under `popup/`. Styles sit in `popup/css/`, UI imagery in `popup/img/`, reusable fixtures in `popup/mockData/`, and entry scripts plus shared logic in `popup/js/`.
- Within `popup/js/`, helper utilities live in `helper/`, state and persistence logic in `model/`, query algorithms in `search/`, and UI presentation in `view/`. The `init*.js` files in this folder are the page-level entry points; the `.bundle.min.js` files are generated artifacts.
- Vendored third-party scripts and styles are checked into `popup/lib/`; product marketing assets (GIFs, screenshots) stay under `images/`.
- Playwright end-to-end specs live in `playwright/tests/`; Jest unit tests belong beside their sources under `__tests__/` folders (e.g. `popup/js/helper/__tests__/`).
- Automation scripts are small Node.js utilities in `bin/`, each wired through `package.json` scripts.
- Built browser artifacts land in `dist/`, arranged by target (e.g. `dist/chrome/...`). Generated reports from local runs sit in `playwright-report/` and `reports/`.

## Build, Test, and Development Commands

- `npm run clean` wipes previous build output.
- `npm run build` cleans, refreshes manifests, and assembles the minified production build in `dist/`.
- `npm run watch` rebuilds bundles on file changes so `dist/` stays fresh during extension development.
- `npm run start` serves the popup source (`./popup/`) via `serve` for quick UI checks with mock data.
- `npm run start:dist` previews the built Chrome bundle from `dist/chrome/popup/`.
- `npm run test` executes Jest unit tests (alias of `test:unit`) and forwards additional arguments, so use `npm run test path/to/file.test.js` for single-file runs.
- `npm run test:e2e` executes the Playwright flow tests headless. The Playwright runner boots its own static server automatically.
- `npm run test:e2e:chromium|firefox|edge` target individual browsers.
- `npm run test:unit` runs Jest unit tests. Run it like `npm run test:unit <filename>.test.js` for individual test file execution.
- `npm run test:unit:coverage` runs Jest unit tests with code coverage report. Run it like `npm run test:unit:coverage <filename>.test.js` for individual test file execution.
- `npm run lint` runs Biome's lint + format verification across the popup source.
- `npm run analyze` runs `bin/analyze-code.js` for bundle diagnostics.
- `npm run size` reports post-build bundle sizes.

## Coding Style & Naming Conventions

- Source is modern ESM JavaScript; keep modules side-effect-light and prefer explicit exports.
- Follow `biome.json`: two-space indentation, single quotes, and no trailing semicolons.
- Name files by feature (e.g. `searchResultsView.js`, `browserApi.js`) and mirror that style for co-located tests (`*.test.js`).
- Do not excessively create dependencies, prefer a lightweight "vanilla JS" style
- Use US English spellings consistently (avoid UK variants)

## Documentation & Comment Style

- Start each non-test `.js` module with an `@file` block that summarizes its purpose and primary responsibilities. Give a good high-level summary, even if it becomes a bit longer.
- Provide a brief JSDoc block for every exported function (and notable helper) covering intent, key parameters, and return shape when applicable. Don't repeat yourself across this and don't document what is already obvious from the function signature.
- Prefer concise inline comments only where the flow is non-obvious; avoid restating self-explanatory code.
- Keep comment tone factual and implementation-aligned—update or remove stale remarks when behavior changes.
- Standard block style: open with `/**`, write a single-sentence summary ending with a period on its own line, leave a blank line before any longer descriptions and another blank line before `@param`/`@returns` tags, and close with `*/`. Use this multi-line format for modules and exported functions; reserve one-line `/** ... */` comments for simple constant notes only.

## Testing Guidelines

- Follow the verify loop: run `npm run lint`, then run focused Jest specs via `npm run test <file>` for fast feedback, and finish with a full `npm run test:e2e`. When the e2e suite fails, narrow it down by rerunning a single spec file (e.g. `npm run test:e2e -- tests/editBookmark.spec.js`).
- Use Jest for deterministic unit coverage; stub DOM APIs with jsdom helpers when needed.
- Use Playwright for integration coverage of popup interactions; keep specs independent and idempotent.
- Name unit tests `<module>.test.js` under `__tests__` directories and describe behavior in plain language (`describe('timeSince')`).
- Tests must be deterministic, isolated, and clear.
- Execute a single test using:
  ```bash
  npm run test:unit <filename>.test.js
  // When coverage is needed:
  npm run test:unit:coverage <filename>.test.js
  ```
- Use the [test-engineer](.github/agents/test-engineer.md) agent role.

## Commit & Pull Request Guidelines

- **REQUIRED**: Write a changelog entry for any end-user relevant change (features, bug fixes, UI changes, performance improvements, etc.).
- Write imperative, descriptive commits (e.g. `Add Jest unit testing setup and initial tests`).
- Reference related issues, include context, and attach screenshots or GIFs for visual changes.
- Run lint, Jest, and Playwright locally before opening or updating a PR.
- Always run `npm run lint` and `npm run test:unit` before committing code.

## Security & Configuration Tips

- Use Node.js 18 LTS or newer; the build system depends on modern ESM support.
- Review `bin/` scripts before running them; many assume a Unix-like shell environment.
- Keep manifests up to date via `npm run build:update-manifests` to avoid browser permission drift.
