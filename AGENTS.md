# Repository Guidelines

## Project Structure & Module Organization

- Core popup code lives under `popup/`; logic is split into `popup/js/helper/`, `popup/js/model/`, `popup/js/search/`, and `popup/js/view/` to keep utilities, data, search logic, and UI concerns isolated.
- Cypress end-to-end specs are in `cypress/e2e/`; Jest unit tests belong beside their sources under `__tests__` folders (e.g. `popup/js/helper/__tests__/`).
- Static assets such as images and third-party libraries reside in `images/` and downloaded packages; built browser artifacts land in `dist/`.

## Build, Test, and Development Commands

- `npm run build` cleans, refreshes manifests, and assembles distributable browser bundles.
- `npm run start` serves the popup locally via `live-server` for quick UI checks.
- `npm run test` executes the Cypress flow tests headlessly. Requires `npm run start` to run in the background.
- `npm run test:unit` runs Jest unit tests targeting helpers and models.
- `npm run lint` enforces the shared ESLint rules across popup JavaScript.

## Coding Style & Naming Conventions

- Source is modern ESM JavaScript; keep modules side-effect-light and prefer explicit exports.
- Follow `eslint.config.mjs`: two-space indentation, single quotes, and no trailing semicolons.
- Name files by feature (e.g. `searchResultsView.js`, `browserApi.js`) and mirror that style for co-located tests (`*.test.js`).

## Testing Guidelines

- Use Jest for deterministic unit coverage; stub DOM APIs with jsdom helpers when needed.
- Use Cypress for integration coverage of popup interactions; keep specs independent and idempotent.
- Name unit tests `<module>.test.js` under `__tests__` directories and describe behaviour in plain language (`describe('timeSince')`).

## Commit & Pull Request Guidelines

- Write imperative, descriptive commits (e.g. `Add Jest unit testing setup and initial tests`).
- Reference related issues, include context, and attach screenshots or GIFs for visual changes.
- Run lint, Jest, and Cypress locally before opening or updating a PR.
- Always run `npm run lint` and `npm run test:unit` before committing code.

## Security & Configuration Tips

- Review `bin/` scripts before running them; many assume a Unix-like shell environment.
- Keep manifests up to date via `npm run update-manifests` to avoid browser permission drift.
