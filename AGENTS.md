# Agent Guidelines

Context and guidelines for AI agents working on this codebase.

## Project Context

**Browser extension** for (fuzzy) search across bookmarks, history, and tabs.

- **Stateless**: No storage except user options. Loads fresh on every popup open.
- **No Background Process**: Runs only when popup is open.
- **Privacy**: No network, telemetry, or data collection.
- **Performance**: Instant search (<16ms) for 10k+ items.

### Execution Flow

1. **Init**: Load options → fetch data → pre-normalize.
2. **Idle**: Show recent tags/bookmarks.
3. **Search**: Debounced search → score/sort → render.
4. **Action**: Selection → switch to tab or navigate.

### Architecture Overview

```bash
popup/
├─ js/
│  ├─ init*.js             # Entry points: Initializers for search and options pages
│  ├─ helper/              # Pure utilities: DOM helpers and browser API wrappers
│  ├─ model/               # Data & Config: Options management and data normalization
│  ├─ search/              # Core Logic: All search algorithms and orchestration
│  │  ├─ common.js         # Coordinator: Orchestrates the search flow and caching
│  │  ├─ simpleSearch.js   # Exact Match: Fast substring-based search strategy
│  │  ├─ fuzzySearch.js    # uFuzzy: Approximate matching using uFuzzy library
│  │  ├─ taxonomySearch.js # Taxonomy: Filtering by tags (#) and folders (~)
│  │  ├─ queryParser.js    # Parser: Detects search modes, tags, and commands
│  │  ├─ scoring.js        # Ranking: Algorithm for sorting and scoring results
│  │  ├─ searchEngines.js  # Engines: Fallback search engine result generation
│  │  └─ defaultResults.js # Defaults: Results shown when the query is empty
│  └─ view/                # UI Rendering: DOM manipulation and result display
├─ css/                    # Styling: CSS files for popup and options UI
└─ lib/                    # Dependencies: Vendored libs (uFuzzy, Tagify, js-yaml)
```

## Commands

- **Build**:
  - `npm run build`: Full build (libs, bundle, manifests, dist, format)
  - `npm run watch`: Dev mode (auto-rebuild)
  - `npm run clean`: Remove build artifacts
  - `npm run build:bundle`: JS/CSS bundle only
- **Run**:
  - `npm run start`: Mock data (localhost:8080)
  - `npm run start:dist`: Serve production build
- **Test**:
  - `npm run lint`: Biome lint/format check (`:fix` to auto-fix)
  - `npm run test`: All unit tests (`npm run test <file>` for specific)
  - `npm run test:watch`: Jest watch mode
  - `npm run test:unit:coverage`: Coverage report
  - `npm run test:e2e`: Playwright E2E (chromium/firefox)
- **Perf**:
  - `npm run test:perf`: All benchmarks + summary
- **Analysis**:
  - `npm run size`: Bundle size report
  - `npm run analyze`: Code diagnostics

## Verify Loops

- **Standard**: `lint` → `test <file>` → `test:e2e` (UI/behavior)
- **Performance**: `lint` → `test <file>` → `test:perf`
  - *Targets*: Search <20ms (5k items), Render <16ms (60fps)
- **Full**: `lint` → `test` → `test:e2e` → `test:perf` → `build`

## Performance Guidelines

Search must feel instant (<16ms). 5k+ item collections are common.

- **Zero-DOM Highlighting**: Pre-compute `<mark>` tags as strings (no DOM ops during search).
- **Pre-normalization**: Lowercase and prepare search strings during `init`.
- **Avoid Object Spread**: Use direct property assignment in hot loops.
- **Regex Caching**: Compile patterns once, reuse across iterations.
- **Compact Templates**: Minimize whitespace in HTML templates for faster `innerHTML`.
- **Early Limiting**: Filter and slice before expensive operations.

### Measuring & Workflow
- **Micro**: `npm run test -- performance.test.js`
- **Algorithm**: `npm run test -- comparison.test.js`
- **E2E**: `npm run test:e2e -- performance.spec.js`
- **Workflow**: Establish baseline (`main`) → Apply → Compare (`test:perf`).

## Coding Standards

- **Tech**: ESM, Vanilla JS (No TS).
- **Style**: Biome (2 spaces, single quotes, no semicolons).
- **Docs**: JSDoc `@param`/`@returns` for exports; `@file` header for modules.

### Module Responsibilities

- `helper/`: Pure utilities, no side effects (e.g., `escapeHtml`, `cleanUpUrl`)
- `model/`: Data loading/config (e.g., `getEffectiveOptions`)
- `search/`: Algorithms/orchestration (e.g., `fuzzySearch`, `scoring`)
- `view/`: DOM updates/rendering (e.g., `renderSearchResults`)

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
