# Bookmark Manager Beta Release Review

Date: 2026-05-08
Reviewed commit: `c7f29a3`

## Verdict

The Bookmark Manager is ready for a beta release after the release-blocking cleanup items were fixed and the full verification loop passed.

Keep the beta framing and the backup/export guidance. Bulk bookmark mutation still deserves conservative UX because undo is memory-only and recreated deleted bookmarks cannot preserve original browser IDs. That said, AI cleanup now validates duplicate deletes against actual duplicate pairs, requires final confirmation for category/all apply, handles partial failures explicitly, and has targeted tests around the highest-risk paths.

The feature is in solid shape for beta: it is popup-independent, uses no external network/telemetry, keeps undo memory-only, has bookmark HTML export, validates proposal IDs against the current model, degrades when bookmark APIs or local AI are unavailable, and now has stronger unit/E2E/perf coverage around the manager and options readiness paths.

## Beta Blocker Execution Checklist

- [x] AI Cleanup delete proposals only accept actual duplicate bookmark pairs.
  - Commit: `57ba4b1` (`Harden bookmark cleanup apply flow`)
  - Tests: cleanup proposal validation rejects/drops non-duplicate delete pairs.
- [x] AI Cleanup `Apply All` and category `Accept All` require a final confirmation summary.
  - Commit: `57ba4b1` (`Harden bookmark cleanup apply flow`)
  - Tests: confirmation summary counts action types and warns for destructive/structural changes.
- [x] Bulk AI cleanup handles partial failures without marking failed changes as applied.
  - Commit: `62e4b92` (`More transactional snapshots / apply`)
  - Tests: entrypoint test simulates one successful cleanup change and one failed change; failed change stays pending and status includes failed IDs/bookmark IDs.
- [x] Large multi-select local AI tag suggestions warn/abort instead of sampling only the first 16 bookmarks.
  - Commit: `d7c8246` (`Warn before large AI tag suggestions`)
  - Tests: entrypoint test cancels a 21-bookmark suggestion before `LanguageModel.availability/create`; helper test covers warning copy.
- [x] Cleanup prompt bookmark-count control and truncation/context-budget feedback.
  - Commit: `6ee7e77` (`Add cleanup prompt context limit`)
  - Tests: cleanup prompt payload test covers bookmark limits and omitted counts; manager view/entrypoint tests include the new control; Bookmark Manager E2E passes.
- [x] Duplicate ranking respects `customBonusScore`.
  - Commit: `301f380` (`Respect favorite score in duplicate ranking`)
  - Tests: duplicate ranking unit test proves a favorited `+50` duplicate is kept over a newer/tagged copy; duplicate rendering and Bookmark Manager E2E pass.
- [x] Tag normalization is consistent across manual input, local AI suggestions, and AI cleanup proposals.
  - Commit: `ed20c67` (`Normalize bookmark manager tags consistently`)
  - Tests: operations, tag-control, cleanup-proposal, local-AI, entrypoint, and Bookmark Manager E2E tests pass with lowercase hyphenated tags.
- [x] Remove noisy local AI cleanup debug logging before public beta.
  - Commit: `47127e8` (`Gate local cleanup debug logging`)
  - Tests: entrypoint unit tests and Bookmark Manager E2E pass; debug output is gated behind `localStorage.bookmarkManagerDebugLocalAi === 'true'`.
- [x] Remove stray empty branch in `reloadBookmarkManager`.
  - Commit: `476c968` (`Clean bookmark manager reload flow`)
  - Tests: entrypoint unit tests and Bookmark Manager E2E pass.
- [x] Run final beta verification loop: full lint, unit tests, Chromium E2E, perf tests, size check.
  - Commit: final report update.
  - Result: all checks passed on `c7f29a3`.

## Validation Run

- `npm run lint`: passed, 134 files checked.
- `npm run test:unit`: passed, 45 suites and 499 tests.
- `npm run test:e2e`: passed, 69 Chromium Playwright tests.
- `npm run test:perf`: passed with no performance regressions.
- `npm run size`: passed; `chrome.zip` is 443.3 KB and `js/initBookmarkManager.bundle.min.js` is 117.8 KB.

Additional targeted checks were run while fixing final verification failures:

- `npm run test:unit -- popup/js/view/__tests__/editOptionsView.test.js`: passed, including a new async-load edit preservation test.
- `npx playwright test --project=chromium playwright/tests/errorOverlay.spec.js playwright/tests/options.spec.js`: passed, 21 tests.
- `npx playwright test --project=chromium playwright/tests/performance.spec.js`: passed, 5 tests.

Not rerun today: manual real-browser bookmark mutation/export/import matrix across Chrome, Edge, and Firefox.

## Release-Blocking Before Broad Beta

### AI Cleanup can delete non-duplicate bookmarks

Status: fixed in `57ba4b1`.

Original finding: `validateDeleteChanges` and liberal parsing only verified that `bookmarkId` and `duplicateOfBookmarkId` existed and differed. They did not verify that both bookmarks had the same normalized URL, belonged to a known duplicate group, or matched the manager's duplicate cleanup model.

Impact: a bad local/external LLM proposal, or pasted JSON, can present an arbitrary bookmark deletion as "Delete Duplicate Bookmarks" and the parser will accept it as long as the IDs exist.

Done: delete proposals are validated against actual duplicate pairs and tests prove different-URL pairs are rejected/dropped.

### AI Cleanup Apply All / Accept All has no final confirmation

Status: fixed in `57ba4b1`.

Original finding: the cleanup UI correctly said users should review proposals, but `Apply All` and per-category `Accept All` executed immediately once clicked. This included deletes.

Impact: one accidental click can move, rename, retag, rewrite, and delete many bookmarks. Undo snapshots mitigate this, but they are memory-only and restoring recreated deleted bookmarks may not preserve original IDs.

Done: category/all apply now requires a confirmation summary that highlights destructive and structural changes.

## Important Beta Findings

### Bulk AI cleanup is not transactional

Status: mitigated in `62e4b92`.

Original finding: `applyCleanupChanges` created one undo snapshot, then applied changes sequentially. If change 4 of 20 failed, the first 3 were already persisted and the UI did not report the exact partial state clearly enough.

Done: the apply path keeps one undo snapshot, tracks per-change success/failure, reports partial results, and leaves failed changes pending instead of marking them applied.

### Local tag suggestions sample only 16 bookmarks

Status: fixed in `d7c8246`.

Original finding: local AI tag suggestions capped prompt input at 16 bookmarks. Strict multi-select mode filtered suggested tags against all selected bookmarks, but the liberal retry skipped that evidence filter.

Impact: for large selections, the second-try "broader" suggestion can be based on the first 16 bookmarks and then applied to the whole selection.

Done: large selections warn before invoking local AI and can be aborted.

### Cleanup prompt truncates large libraries silently

Status: fixed in `6ee7e77`.

Original finding: cleanup prompt payloads sliced bookmark input to 2000 entries and did not tell the model or user that entries were omitted.

Done: cleanup prompt generation has a bookmark-context selector, omitted count feedback, and a character budget guard.

### Duplicate ranking still ignores favorite score

Status: fixed in `301f380`.

Original finding: duplicate keep-candidate ranking used tag count, title quality, recency, then folder depth, but did not include `customBonusScore`.

Impact: a user-favorited `+50` bookmark can still be ranked below a duplicate with more tags or a newer date.

Done: duplicate keep-candidate ranking uses `customBonusScore` and has a unit test.

### Tag normalization remains inconsistent

Status: fixed in `ed20c67`.

Original finding: manual tag input normalized whitespace to spaces, while cleanup proposals normalized whitespace to hyphens. This could split equivalent concepts into separate tag groups.

Done: manager tag paths now use canonical lowercase hyphenated tags.

### Debug logging should be toned down

Status: fixed in `47127e8`.

Original finding: AI cleanup emitted unconditional `console.debug` diagnostics. Debug logs are useful while stabilizing the Prompt API path, but noisy for a public beta.

Done: local AI cleanup debug logging is gated behind `localStorage.bookmarkManagerDebugLocalAi === 'true'`.

### Stray empty branch should be cleaned

Status: fixed in `476c968`.

`reloadBookmarkManager` no longer contains the empty `if (!preservedSelection) {}` block.

## Test Gaps To Add

- Real bookmark API E2E or manual matrix for `bookmarks.update`, `bookmarks.move`, `bookmarks.remove`, `bookmarks.create`, undo restore, bookmark export/import, and API-unavailable fallback.
- Browser matrix for Chrome, Edge, Firefox: manager load, passive read-only states, mutation actions, local AI unavailable/downloadable states.
- A browser-level test for local AI cleanup unavailable/downloadable/downloading states if Prompt API mocking becomes stable enough.
- More partial-failure coverage for non-AI bulk tag, move, and delete loops. AI cleanup partial failure is now covered.

## Cleanup / Refactoring Suggestions

- Split `initBookmarkManager.js` into smaller controller modules: bookmark browsing/editing, duplicate cleanup, tag manager, undo/export, and AI cleanup. At ~1600+ lines, it is now the highest-risk file to keep extending.
- Move undo import/export helpers out of `initBookmarkManager.js` into the undo model so they can be unit tested without DOM setup.
- Move cleanup apply logic into a model/controller helper that returns a structured result `{ applied, failed, skipped }`.
- Centralize tag normalization so manual entry, Tagify controls, local tag suggestions, and cleanup proposal parsing all use the same canonical form.
- Make destructive cleanup actions share one confirmation/summarization helper.
- Consider using a small render/update abstraction for repeated `innerHTML` screens only if the manager grows further; do not add dependencies for this.

## Local LLM Improvement Ideas

- Local tag taxonomy cleanup: detect near-duplicate tags and propose merges with counts, examples, and affected bookmark IDs.
- Duplicate explanation assistant: for each duplicate group, summarize what metadata would be lost by deleting each copy.
- Folder suggestion assistant: suggest existing destination folders, but only after validating target folders and showing before/after paths.
- Title cleanup assistant: rewrite URL-like or boilerplate titles while preserving tags and `+N` score metadata.
- Natural-language selection: translate requests such as "show untagged GitHub docs in old folders" into existing local search/folder/tag filters.
- Dead-link triage only as an opt-in future feature; it would require network access and conflicts with the current no-network project rule.
- Optional local embeddings only if explicitly enabled by users. Embeddings could improve clustering and semantic tagging, but they add persistent state, privacy review, storage limits, and migration concerns.

## Recommendation

Proceed with beta, with backup/export guidance kept prominent.

Before a broader public announcement, run a small manual real-browser mutation/export/import matrix in Chrome, Edge, and Firefox. The automated release loop is green, but browser bookmark APIs and local AI availability states still deserve manual coverage.
