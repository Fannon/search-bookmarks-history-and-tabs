# AGENTS.md

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Pragmatic Changes

**Make the change as small as it can be while still producing the best overall outcome.**

When editing existing code:
- Prefer focused changes, but don't be so surgical that the result is awkward, duplicated, or harder to maintain.
- It is acceptable to touch nearby code, tests, or call sites when that creates a clearer boundary, avoids duplicated work, or makes the behavior easier to verify.
- Don't do opportunistic cleanup, broad refactors, or style churn that does not support the requested change.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should have a defensible reason tied to the user's request or to keeping the implementation coherent.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

## 5. Project rules

- Scope: browser extension popup only; no background worker, network, or telemetry; stateless except user options.
- Style: ESM and vanilla JS. Follow Biome formatting: 2 spaces, single quotes, no semicolons.
- Size: keep the extension small. Do not add dependencies without approval.
- Search: keep it instant on large datasets; precompute searchable fields during data loading.
- Hot paths: avoid unnecessary DOM work, allocations, regex compilation, and object cloning.
- Validation: for search, scoring, render, or cache changes, run relevant unit tests and `npm run test:perf`.
- Failures: browser API failures `console.warn` and return empty results; options failures use defaults and `printError`; search/render failures show the dismissible overlay via `printError`.

## 6. Commands

- Use Node.js 24.21 or newer and the npm version in `packageManager`; install reproducibly with `npm ci`.
- While editing, prefer focused, read-only feedback:
  - Files: `npm run lint -- path/to/touched.js` or `npm run lint -- --staged`.
  - Unit: `npm run test:unit -- path/to/file.test.js` (multiple paths or quoted globs are supported).
  - Test names: `npm run test:unit -- --test-name-pattern='pattern' path/to/file.test.js`.
  - E2E: `npx playwright test path/to/test.spec.js --project=chromium` for affected UI or browser behavior.
- `--changed --since=origin/main` checks committed branch changes only; use explicit file paths while editing unstaged changes.
- Before handing off code changes, run `npm run check` (read-only Biome formatting, lint, import checks, and all unit tests). This does not build or launch browsers.
- Changes to search, scoring, rendering, or caching also require `npm run test:perf`. Run affected Chromium E2E tests for UI or behavior changes.
- Fixes are explicit: `npm run fix -- path/to/touched.js` applies safe Biome fixes and import organization; `npm run format -- path/to/touched.js` only formats. Review the diff. Never add `--unsafe` or restage files automatically.
- Write unit tests with `node:test`, `node:assert/strict`, and native mocks. Popup tests needing the DOM import `test/setup.js`; use `resetModules` from `test/modules.js` only when a bootstrap test needs fresh ESM imports. Tests in `bin/` use Node directly.
- There is no TypeScript configuration or typecheck command. Biome checks JavaScript; assertions verify behavior.
- Git commits do not run repository hooks. Validation is explicit, and CI is the authoritative gate.
- For older checkouts with installed Lefthook hooks, run `npx --yes lefthook@2.1.16 uninstall` once. Do not install replacement hooks.
- Full coverage (`npm run test:unit:coverage`), complete Chromium/Firefox E2E suites, and production builds run in CI. Run them locally when investigating a relevant failure; do not add them to Git hooks or the fast `check` command.
- Run `npm run size` for dependency, bundling, shared utility, or significant code-size changes.
- Run `npm run build` only when explicitly requested or for release work.
