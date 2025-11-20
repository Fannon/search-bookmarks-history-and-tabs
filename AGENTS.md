# Repository Guidelines

## Structure
- `popup/`: Source (`js/`, `css/`, `img/`). Entry points: `init*.js`. Shared: `helper/`, `model/`, `search/`, `view/`.
- `dist/`: Build artifacts. `bin/`: Automation scripts.
- `playwright/`: E2E tests. `__tests__/`: Unit tests (co-located).

## Commands
- **Build**: `npm run build` (prod), `npm run watch` (dev), `npm run clean`.
- **Run**: `npm run start` (mock UI), `npm run start:dist` (preview).
- **Test**: `npm run test` (Unit), `npm run test:e2e` (Playwright).
- **Quality**: `npm run lint` (Biome), `npm run analyze`, `npm run size`.

## Standards
- **Code**: Modern ESM, "vanilla JS" style. Follow `biome.json` (2 spaces, single quotes).
- **Naming**: Feature-based (`searchResultsView.js`). Tests: `*.test.js`.
- **Docs**: `@file` header for modules. JSDoc for exports. Concise inline comments.
- **Security**: Node 18+. Update manifests via `npm run build:update-manifests`.

## Workflow
1. **Verify**: `npm run lint` -> `npm run test <file>` -> `npm run test:e2e`.
2. **Commit**: Imperative msgs. Reference issues. **Always** lint & unit test first.
3. **PR**: Use `gh pr create`. **ALWAYS** provide the PR link to the user.
4. **Rules**: **NEVER push to `main`**. Create feature branches.
