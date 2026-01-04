# Contributing to Search Bookmarks, History & Tabs Extension

Thank you for your interest in contributing!
This project is a browser extension for searching and navigating bookmarks, history, and open tabs.
Please review the guidelines below before submitting changes.

## Getting Started

- **Read the [README.md](./README.md)** for project overview, features, and user configuration.
- **Review [AGENTS.md](./AGENTS.md)** for architecture, commands, performance guidelines, and coding standards.
- **See [OPTIONS.md](./OPTIONS.md)** for all available configuration options.
- **Use Node.js 22 LTS or newer.** The build scripts rely on ESM and modern language features.

## Local Development

### Install and Build

- Prerequisite: [Node.js](https://nodejs.org/en/) v22 or newer and a bash-compatible shell.
- Install dependencies with `npm install`.
- Build bundles with `npm run build`. This generates the minified output in `dist/`
- The locally built extension can be installed / side-loaded into browsers either on the root level (for local development state) or on the `/dist/chrome` level (for minified production build).
- For iterative changes, run `npm run watch` to rebuild bundles automatically on source edits.
- Serve the popup source directly via `npm run start` or preview the dist build with `npm run start:dist`.
- Use `npm run clean` to reset build artifacts if you encounter inconsistent bundles.

### Project Structure

- `popup/` contains popup HTML, CSS, entry scripts, and bundled libraries.
  - `popup/js/helper/` holds shared utilities.
  - `popup/js/model/` defines data models and configuration defaults (see `options.js`).
  - `popup/js/search/` coordinates search orchestration and parsing.
  - `popup/js/view/` renders the UI and wires helpers to DOM updates.
  - `popup/js/**/__tests__/` groups Jest unit tests alongside their modules.
- `playwright/tests/` stores end-to-end scenarios.
- `images/` includes static assets referenced by the popup.
- `dist/` contains the minified production build (`dist/chrome/`). Firefox now uses the same Chrome manifest.

### Developer Installation

- **Chrome / Edge**
  - Open `chrome://extensions/` (Chrome) or `edge://extensions/` (Edge).
  - Enable "Developer mode".
  - Choose "Load unpacked" and select `dist/chrome/`.
- **Firefox**
  - After running `npm run build`, open `about:debugging`.
  - Click "This Firefox" → "Load Temporary Add-on…" and pick the `manifest.json` inside `dist/chrome/` (the Chrome build works for temporary installs).
  - Temporary add-ons must be reloaded after every browser restart.
- **Iterating on changes**
  - Re-run `npm run build` before reloading the extension, or keep `npm run watch` running so the `dist/` output stays in sync with source edits.

### Developer Workflow

- `npm run build` - Complete build pipeline (clean → bundle → manifest updates → dist packaging → size report).
- `npm run watch` - Rebuild bundles on file changes (keeps `dist/` up to date for sideloading).
- `npm run start` / `npm run start:dist` - Serve the popup source or built output locally.
- `npm run test` or `npm run test:unit` - Run Jest unit tests; use `npm run test:unit:coverage` for coverage.
- `npm run test:e2e` - Run Playwright end-to-end tests (browser-specific variants available).
- `npm run lint` - Run Biome checks (format + lint) across the source.
- `npm run analyze` - Run code analysis helper (`bin/analyze-code.js`).
- `npm run size` - Report bundle sizes after a build.

See also: [AGENTS.md](./AGENTS.md) for architecture overview, verify loops, and performance guidelines.

## How to Contribute

1. **Fork the repository** and create your branch from `main`.
2. **Install dependencies:**

```bash
npm install
```

3. **Build and run locally:**

- Build once with `npm run build`. This cleans the workspace, refreshes manifests, bundles scripts, and copies artifacts to `dist/`.
- Use `npm run watch` while iterating. It rebuilds bundles automatically when files change so `dist/` mirrors your edits.
- Preview the popup UI from source with `npm run start` (serves `./popup/` at http://localhost:8080).
- Preview the built extension with `npm run start:dist` (serves `./dist/chrome/popup/`).
- For manual browser install / side-loading steps see [Developer Installation](#developer-installation).

4. **Testing:**

- Lint source code: `npm run lint` (Biome verification across the repo).
- Run Jest unit tests: `npm run test` or `npm run test:unit`. Scope to a file with `npm run test:unit <module>.test.js`.
- Collect coverage when needed: `npm run test:unit:coverage <module>.test.js`.
- Run Playwright end-to-end specs: `npm run test:e2e`. Browser-specific runners exist (`test:e2e:chromium`, `test:e2e:firefox`, `test:e2e:edge`).

5. **Code Style & Patterns:**

- Follow the module layout and naming rules in [AGENTS.md](./AGENTS.md).
- Place search logic in `popup/js/search/`, views in `popup/js/view/`, models in `popup/js/model/`, and helpers in `popup/js/helper/`.
- Use bundled libraries from `popup/lib/` (see README for details).

6. **Adding Features:**

- For new search modes, update query parsing in `popup/js/search/queryParser.js` and relevant search files.
- Document changes in `README.md` and `OPTIONS.md` if user-configurable.

7. **Pull Requests:**

- Ensure your code is tested, linted, and documented.
- Run `npm run lint`, `npm run test`, and (when applicable) `npm run test:e2e` before opening a PR.
- For search or rendering changes, also run `npm run test:perf` to check for performance regressions.
- Reference related issues in your PR description.
- Keep PRs focused and concise.

## Reporting Issues

- Use GitHub Issues for bugs, feature requests, or questions.
- Include steps to reproduce, expected behavior, and relevant logs/screenshots.

---

For questions or feedback on these guidelines, open an issue or start a discussion.  
Happy coding!
