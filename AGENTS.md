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

- Run `npm run lint` for code changes; use `npm run lint:fix` only for fixable issues in touched files.
- Prefer focused tests before broader suites:
  - Unit: `npm run test:unit -- path/to/test.js`
  - E2E: `npx playwright test path/to/test.spec.js --project=chromium`
- Run `npm run test:unit` for code changes.
- Run `npm run test:e2e` for UI or behavior changes.
- Run `npm run size` for dependency, bundling, shared utility, or significant code-size changes.
- Run `npm run build` only when explicitly requested or for release work.
