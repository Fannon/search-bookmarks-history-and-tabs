# Repository Guidelines

## Project Structure & Module Organization

- Core popup code lives under `popup/`; logic is split into `popup/js/helper/`, `popup/js/model/`, `popup/js/search/`, and `popup/js/view/` to keep utilities, data, search logic, and UI concerns isolated.
- Playwright end-to-end specs are in `playwright/tests/`; Jest unit tests belong beside their sources under `__tests__` folders (e.g. `popup/js/helper/__tests__/`).
- Static assets live in `images/`; bundled third-party scripts and styles are in `popup/lib/`; built browser artifacts land in `dist/`.
- Automation scripts live in `bin/`; they are small Node.js programs wired up through `package.json` scripts.

## Build, Test, and Development Commands

- `npm run clean` wipes previous build output.
- `npm run build` cleans, refreshes manifests, and assembles the minified production build in `dist/`.
- `npm run watch` rebuilds bundles on file changes so `dist/` stays fresh during extension development.
- `npm run start` serves the popup source (`./popup/`) via `serve` for quick UI checks with mock data.
- `npm run start:dist` previews the built Chrome bundle from `dist/chrome/popup/`.
- `npm run test` executes jest unit tests. It's an alias to `test:unit`
- `npm run test:e2e` executes the Playwright flow tests headlessly. The Playwright runner boots its own static server automatically.
- `npm run test:e2e:chromium|firefox|edge` target individual browsers.
- `npm run test:unit` runs Jest unit tests. Run it like `npm run test:unit <filename>.test.js` for individual test file execution.
- `npm run test:unit:coverage` runs Jest unit tests with code coverage report. Run it like `npm run test:unit:coverage <filename>.test.js` for individual test file execution.
- `npm run lint` enforces the shared ESLint rules across popup JavaScript.
- `npm run analyze` runs `bin/analyze-code.js` for bundle diagnostics.
- `npm run size` reports post-build bundle sizes.

## Coding Style & Naming Conventions

- Source is modern ESM JavaScript; keep modules side-effect-light and prefer explicit exports.
- Follow `eslint.config.mjs`: two-space indentation, single quotes, and no trailing semicolons.
- Name files by feature (e.g. `searchResultsView.js`, `browserApi.js`) and mirror that style for co-located tests (`*.test.js`).
- Do not excessively create dependencies, prefer a lightweight "vanilla JS" style
- Use American English consistently

## Documentation & Comment Style

- Start each non-test `.js` module with an `@file` block that summarizes the module in one or two sentences.
- Keep JSDoc blocks succinct: use a single summary line and only add `@param`/`@returns` tags when they convey detail not obvious from the signature.
- Avoid repeating the same wording between the summary line and parameter tags.
- Prefer concise inline comments only where the flow is non-obvious; avoid restating self-explanatory code.
- Keep comment tone factual and implementation-aligned—update or remove stale remarks when behavior changes.
- Standard block style: open with `/**`, write a single-sentence summary ending with a period on its own line, leave a blank line before any `@param`/`@returns` tags, and close with `*/`. Use this multi-line format for modules and exported functions; reserve one-line `/** ... */` comments for simple constant notes only.

## Testing Guidelines

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

- Write imperative, descriptive commits (e.g. `Add Jest unit testing setup and initial tests`).
- Reference related issues, include context, and attach screenshots or GIFs for visual changes.
- Run lint, Jest, and Playwright locally before opening or updating a PR.
- Always run `npm run lint` and `npm run test:unit` before committing code.

## Security & Configuration Tips

- Use Node.js 18 LTS or newer; the build system depends on modern ESM support.
- Review `bin/` scripts before running them; many assume a Unix-like shell environment.
- Keep manifests up to date via `npm run build:update-manifests` to avoid browser permission drift.
