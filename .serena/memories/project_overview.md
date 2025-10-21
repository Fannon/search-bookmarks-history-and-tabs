# Project Overview
- Purpose: Browser extension popup that lets users search bookmarks, history, and open tabs quickly.
- Tech stack: Modern ESM JavaScript with Node/npm tooling, Jest for unit tests, Playwright for e2e.
- Structure highlights: core popup code under `popup/` with logic split across `js/helper`, `js/model`, `js/search`, `js/view`; tests in `popup/js/**/__tests__/` and `playwright/tests/`; assets in `images/`; build artifacts in `dist/`.