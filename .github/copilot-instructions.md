# Copilot Instructions for AI Coding Agents

For canonical project guidelines, workflows, and structure details, read `AGENTS.md` at the repository root. Treat that as the single source of truth and keep documentation updates centered there.

## Quick Orientation

- This repository contains a browser extension that searches bookmarks, history, and open tabs using exact and fuzzy strategies.
- Popup source lives in `popup/`; logic is divided between `popup/js/helper/`, `popup/js/model/`, `popup/js/search/`, and `popup/js/view/`.
- User configuration defaults are defined in `popup/js/model/options.js` (`defaultOptions`). They can be overridden via YAML/JSON but are not strongly validated.
- Bundled third-party assets reside in `popup/lib/`. Built artifacts for sideloading are produced under `dist/` by `npm run build`.

## Developer Workflow (see `AGENTS.md` for the full checklist)

- Install dependencies with `npm install`.
- Build distributable bundles via `npm run build`; keep `npm run watch` running during development if you are testing a sideloaded extension.
- `npm run start` serves the popup with mock data; `npm run test` / `npm run test:unit` run Jest; `npm run test:e2e` runs Playwright.
- Scripts in `bin/` handle bundling, manifest updates, dist packaging, and size reporting.

## Architecture Pointers

- Search orchestration lives in `popup/js/search/` (common helpers plus precise/fuzzy flows).
- Views in `popup/js/view/` handle DOM rendering; reusable DOM helpers sit in `popup/js/helper/`.
- Models in `popup/js/model/` manage search data, bookmarks, history integration, and default options.
- Tests are colocated beside modules in `__tests__` folders; end-to-end coverage is under `playwright/tests/`.

## When Updating Docs

- Reflect structural or workflow changes in `AGENTS.md` and link from other markdown files rather than duplicating content.
- Keep `README.md` and `CONTRIBUTING.md` aligned with the same terminology so users and contributors receive consistent instructions.

If additional guidance is needed, ask maintainers or open an issue so we can extend `AGENTS.md` for future agents.
