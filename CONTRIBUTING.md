# Contributing to Search Bookmarks, History & Tabs Extension

Thank you for your interest in contributing!
This project is a browser extension for searching and navigating bookmarks, history, and open tabs.
Please review the guidelines below before submitting changes.

## Getting Started

- **Read the [README.md](./README.md)** for project overview, setup instructions, and usage details.
- **Review [AGENTS.md](./AGENTS.md)** for architecture, data flow, and coding conventions.

## How to Contribute

1. **Fork the repository** and create your branch from `main`.
2. **Install dependencies:**

```bash
npm install
```

3. **Build and run locally:**

- Build: `npm run build`
- Start (with mock data): `npm run start`
- Manual browser install: see [Developer Installation](#developer-installation).

4. **Testing:**

- Run unit tests: `npm run test` (alias to Jest) or target a file with `npm run test:unit <module>.test.js`.
- Run end-to-end tests: `npm run test:e2e` (Playwright specs live in `playwright/tests/`).

5. **Code Style & Patterns:**

- Follow architecture and file conventions in [Copilot Instructions](.github/copilot-instructions.md).
- Place search logic in `popup/js/search/`, views in `popup/js/view/`, models in `popup/js/model/`, and helpers in `popup/js/helper/`.
- Use bundled libraries from `popup/lib/` (see README for details).

6. **Adding Features:**

- For new search modes, update query parsing in `popup/js/search/common.js` and relevant search files.
- Document changes in `README.md` and `popup/js/model/options.js` if user-configurable.

7. **Pull Requests:**

- Ensure your code is tested and documented.
- Reference related issues in your PR description.
- Keep PRs focused and concise.

## Local Development

### Install and Build

- Prerequisite: [Node.js](https://nodejs.org/en/) and a bash-compatible shell.
- Install dependencies with `npm install`.
- Build bundles with `npm run build`. This generates the minified output in `dist/`, which is required for sideloading.
- For iterative changes, run `npm run watch` to rebuild bundles automatically on source edits.

### Project Structure

- `popup/` contains popup HTML, CSS, entry scripts, and bundled libraries.
  - `popup/js/helper/` holds shared utilities.
  - `popup/js/model/` defines data models and configuration defaults (see `options.js`).
  - `popup/js/search/` coordinates search orchestration and parsing.
  - `popup/js/view/` renders the UI and wires helpers to DOM updates.
  - `popup/js/**/__tests__/` groups Jest unit tests alongside their modules.
- `playwright/tests/` stores end-to-end scenarios.
- `images/` includes static assets referenced by the popup.
- `dist/` contains build outputs per browser (e.g., `dist/chrome/`).

### Developer Installation

- **Chrome / Edge**
  - Open `chrome://extensions/` (Chrome) or `edge://extensions/` (Edge).
  - Enable "Developer mode".
  - Choose "Load unpacked" and select `dist/chrome/`.
- **Firefox**
  - After running `npm run build`, open `about:debugging`.
  - Click "This Firefox" → "Load Temporary Add-on…" and pick the `manifest.json` inside `dist/firefox/`.
  - Temporary add-ons must be reloaded after every browser restart.
- **Iterating on changes**
  - Re-run `npm run build` before reloading the extension, or keep `npm run watch` running so the `dist/` output stays in sync with source edits.

### Developer Workflow

- `npm run build` - Complete build pipeline.
- `npm run start` - Serve popup locally with mock data.
- `npm run watch` - Rebuild bundles on file changes (keeps `dist/` up to date for sideloading).
- `npm run test` or `npm run test:unit` - Run Jest unit tests.
- `npm run test:e2e` - Run Playwright end-to-end tests.
- `npm run lint` - Enforce shared ESLint rules.

See also: [Repository Guidelines](./AGENTS.md) and [LLM Agent Docs](./.github/copilot-instructions.md).

## Reporting Issues

- Use GitHub Issues for bugs, feature requests, or questions.
- Include steps to reproduce, expected behavior, and relevant logs/screenshots.

---

For questions or feedback on these guidelines, open an issue or start a discussion.  
Happy coding!
