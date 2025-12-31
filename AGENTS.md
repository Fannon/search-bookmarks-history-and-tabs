# Repository Guidelines

## Structure
- `popup/`: Source root.
  - `lib/`: **Vendored third-party scripts** (checked in).
  - `mockData/`: Reusable fixtures.
  - `js/`: Logic. Entry: `init*.js`. Shared: `helper/`, `model/`, `search/`, `view/`.
- `dist/`: Build artifacts. `bin/`: Automation scripts. `images/`: Marketing assets.
- `playwright/`: E2E tests. `__tests__/`: Unit tests (co-located).

## Commands
- **Build**: `npm run build` (prod), `npm run watch` (dev), `npm run clean`.
- **Run**: `npm run start` (mock UI), `npm run start:dist` (preview built extension).
- **Test**:
  - **Unit**: `npm run test` (runs all).
    - Single file: `npm run test path/to/file.test.js`
    - Coverage: `npm run test:unit:coverage`
  - **E2E**: `npm run test:e2e` (runs all).
    - Single: `npm run test:e2e -- tests/spec.js`
- **Performance**:
  - **All**: `npm run test:perf` (runs all performance benchmarks)
  - **Micro**: `npm run test:unit -- popup/js/__tests__/performance.test.js` (Logic & Search speed)
  - **E2E/Render**: `npx playwright test playwright/tests/performance.spec.js` (Paint & Interaction)
  - **Comparison**: `npm run test:unit -- popup/js/__tests__/comparison.test.js` (Fuzzy vs Precise)
- **Quality**: `npm run lint` (Biome lint/format), `npm run size` (bundle size report).

## Performance Guidelines & Verification
When optimizing code, follow this workflow to ensure measurable improvements:
1. **Establish Baseline**: Run benchmarks on the current `main` or base branch. Note the "Search completed in Xms" and "Search & Render took Yms" outputs.
2. **Implement & Iterate**: Apply changes and run the same benchmarks.
3. **Verify Regression**: Ensure that "Big" datasets (5,000+ items) still stay under the 16ms (60fps) threshold for search and render.
4. **Zero-DOM Rule**: Avoid adding any post-render DOM manipulation steps (like `mark.js` passes which used to be used here). Highlights must be computed during the search phase.

## Standards
- **Code**: Modern ESM, "vanilla JS" style. Follow `biome.json` (2 spaces, single quotes).
- **Naming**: Feature-based (`searchResultsView.js`).
- **Docs**: `@file` header for modules. JSDoc for exports. Concise inline comments.
- **Security**: Node 22+.

## Security & Configuration Tips

- Use Node.js 22 LTS or newer; the build system depends on modern ESM support.
- Review `bin/` scripts before running them; many assume a Unix-like shell environment.
- Keep manifests up to date via `npm run build:update-manifests` to avoid browser permission drift.
- **Approved Commands**: The user has explicitly authorized `npm` commands to be run automatically (SafeToAutoRun: true) when appropriate (e.g. tests, builds, linting).

## Workflow
1. **Verify**: `npm run lint` -> `npm run test <file>` -> `npm run test:e2e`.
2. **Commit**: Imperative msgs. Reference issues. **Always** lint & unit test first.
3. **PR**: Use `gh pr create`. **ALWAYS** provide the PR link to the user.
4. **Rules**: **NEVER push to `main`**. Create feature branches.
