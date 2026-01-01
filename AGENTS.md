# Agent Guidelines

This document provides context and guidelines for AI coding agents working on this codebase.

## Project Context

**This is a browser extension** that provides (fuzzy) search across bookmarks, browser history, and open tabs.

### Key Characteristics

- **Stateless**: The extension stores nothing except user options. Every time the popup opens, it starts fresh from the init phase, loading all data from browser APIs.
- **No background process**: There is no persistent background script. The extension only runs when the user explicitly opens the popup.
- **Privacy-focused**: No external network requests, no telemetry, no data collection.
- **Performance-critical**: Users type search queries character-by-character. The search must feel instant (<16ms for 60fps). Large bookmark/history collections (5,000+ items) are common.

### Execution Flow

1. **Init Phase** (`initSearch.js`): Load user options → fetch bookmarks/tabs/history from browser APIs → pre-normalize data for fast searching
2. **Idle Phase**: Show recent tabs and bookmarks matching current page URL
3. **Search Phase**: User types → debounced search triggered → results scored/sorted → rendered
4. **Action Phase**: User selects result → navigate to URL or switch to tab

### Architecture Overview

```
popup/
├── js/
│   ├── init*.js          # Entry points (one per HTML page)
│   ├── helper/           # Pure utilities (DOM, browser API wrappers, formatting)
│   ├── model/            # Data structures and configuration (options.js, searchData.js)
│   ├── search/           # Search algorithms and orchestration
│   │   ├── common.js         # Main search coordinator
│   │   ├── simpleSearch.js   # Precise (exact-match) search
│   │   ├── fuzzySearch.js    # Fuzzy (approximate) search using uFuzzy
│   │   ├── taxonomySearch.js # Tag (#) and folder (~) filtering
│   │   ├── queryParser.js    # Search mode detection
│   │   ├── scoring.js        # Result ranking algorithm
│   │   ├── searchEngines.js  # Search engine result generation
│   │   └── defaultResults.js # Default results when no search term
│   └── view/             # UI rendering and DOM updates
├── css/                  # Stylesheets
└── lib/                  # Vendored third-party libraries (uFuzzy, Tagify, js-yaml)
```

## Commands

| Category | Command | Description |
|----------|---------|-------------|
| **Build** | `npm run build` | Full production build (clean → libs → bundle → manifests → dist → format → size) |
| | `npm run watch` | Auto-rebuild on changes (development) |
| | `npm run clean` | Remove build artifacts |
| | `npm run build:bundle` | Bundle JS/CSS only |
| **Run** | `npm run start` | Serve popup with mock data at localhost:8080 |
| | `npm run start:dist` | Serve production build |
| **Test** | `npm run lint` | Biome lint and format check |
| | `npm run lint:fix` | Auto-fix lint and format issues |
| | `npm run test` | Run all Jest unit tests |
| | `npm run test <file>` | Run specific test file |
| | `npm run test:watch` | Run tests in watch mode |
| | `npm run test:unit:coverage` | Run tests with coverage report |
| | `npm run test:e2e` | Run Playwright E2E tests (chromium) |
| | `npm run test:e2e:firefox` | Run E2E tests on Firefox |
| **Perf** | `npm run test:perf` | Run all performance benchmarks with summary |
| **Analysis** | `npm run size` | Report bundle sizes |
| | `npm run analyze` | Code analysis and diagnostics |

## Verify Loops

Before committing changes, run the appropriate verify loop based on what you changed.

### Standard Verify Loop (most changes)

```bash
npm run lint                    # 1. Fix any lint/format issues first
npm run test <changed-file>     # 2. Run unit tests for affected modules
npm run test:e2e                # 3. Run E2E tests if UI/behavior changed
```

### Performance Verify Loop (search, scoring, rendering changes)

```bash
npm run lint                    # 1. Fix lint issues
npm run test <changed-file>     # 2. Unit tests pass
npm run test:perf               # 3. Performance benchmarks pass

# Verify no regression:
# - Search: <5ms for 1,000 items, <20ms for 5,000 items
# - Render: <16ms for 24 results (60fps threshold)
```

### Full Verify Loop (before PR)

```bash
npm run lint                    # 1. Lint passes
npm run test                    # 2. All unit tests pass
npm run test:e2e                # 3. All E2E tests pass
npm run test:perf               # 4. No performance regression
npm run build                   # 5. Production build succeeds
```

## Performance Guidelines

Performance is critical for this extension. Follow these rules:

### Hot Path Rules

1. **No DOM manipulation during search** — Use Zero-DOM highlighting (pre-compute `<mark>` tags as strings)
2. **Pre-normalize data at init** — Create lowercase versions, search strings, etc. during data loading
3. **Avoid object spread in loops** — Use direct property assignment for cloning in hot paths
4. **Cache regex patterns** — Compile once, reuse across iterations
5. **Limit results early** — Filter and slice before expensive operations

### Measuring Performance

```bash
# Run micro-benchmarks (search algorithm speed)
npm run test -- popup/js/__tests__/performance.test.js

# Run comparison benchmarks (fuzzy vs precise)
npm run test -- popup/js/__tests__/comparison.test.js

# Run E2E performance tests (real browser timing)
npm run test:e2e -- playwright/tests/performance.spec.js
```

### Performance Verification Workflow

When making changes that could affect performance:

1. **Establish baseline** — Run `npm run test:perf` on `main` branch before changes
2. **Note key metrics** — Record "Search completed in Xms" and "Render took Yms" outputs
3. **Apply changes** — Implement your modifications
4. **Compare results** — Run `npm run test:perf` again and compare against baseline
5. **Verify no regression** — Ensure metrics are not significantly worse (ideally same or better)

## Coding Standards

- **ESM modules**: All source uses ES modules
- **No TypeScript**: Vanilla JavaScript throughout
- **Biome config**: 2 spaces, single quotes, no trailing semicolons
- **JSDoc comments**: Document exports with `@param` and `@returns`
- **File headers**: Each module starts with `@file` describing its purpose

### Module Responsibilities

| Directory | Purpose | Example |
|-----------|---------|---------|
| `helper/` | Pure utility functions, no side effects | `escapeHtml()`, `cleanUpUrl()` |
| `model/` | Data loading and configuration | `getEffectiveOptions()` |
| `search/` | Search algorithms and orchestration | `simpleSearch()`, `calculateFinalScore()` |
| `view/` | DOM updates and UI rendering | `renderSearchResults()` |

## Common Pitfalls

1. **Always test with large datasets** — Small test data hides performance issues
2. **Check both search strategies** — Precise and fuzzy have different code paths
3. **Remember statelessness** — Don't assume any state persists between popup opens
4. **Browser API differences** — Test on Chrome and Firefox; APIs vary slightly
5. **Options validation** — User options are merged with defaults; handle missing/invalid values
6. **Cache invalidation** — Search cache uses `searchTerm_strategy_mode` as key; clear when data changes

## Related Documentation

- **[README.md](README.md)** — User documentation, features, configuration examples
- **[OPTIONS.md](OPTIONS.md)** — Complete list of user-configurable options
- **[CONTRIBUTING.md](CONTRIBUTING.md)** — Local development setup and PR workflow
- **[CHANGELOG.md](CHANGELOG.md)** — Version history and release notes
