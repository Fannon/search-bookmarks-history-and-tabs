# Bookmark Manager Beta Release Review

Date: 2026-05-08
Reviewed commit: `aec8626`

## Verdict

The Bookmark Manager is close, but I would not ship the current implementation as a broad beta without tightening the AI Cleanup apply path first.

It is ready for an internal or very limited beta if the release notes clearly frame the manager as experimental and users are told to export bookmarks before trying bulk actions. For a public beta, fix the two high-risk AI Cleanup issues below: AI-proposed deletes are not proven to be real duplicates, and category/all apply actions run immediately without a second confirmation or dry-run summary.

The rest of the feature is in solid shape for a beta: the manager is popup-independent, uses no external network/telemetry, keeps undo memory-only, has bookmark HTML export, validates proposal IDs against the current model, degrades when bookmark APIs or local AI are unavailable, and has good unit coverage around data/model/view helpers.

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
  - Commit: pending
  - Tests: entrypoint test cancels a 21-bookmark suggestion before `LanguageModel.availability/create`; helper test covers warning copy.
- [x] Cleanup prompt bookmark-count control and truncation/context-budget feedback.
  - Commit: pending
  - Tests: cleanup prompt payload test covers bookmark limits and omitted counts; manager view/entrypoint tests include the new control; Bookmark Manager E2E passes.
- [x] Duplicate ranking respects `customBonusScore`.
  - Commit: pending
  - Tests: duplicate ranking unit test proves a favorited `+50` duplicate is kept over a newer/tagged copy; duplicate rendering and Bookmark Manager E2E pass.
- [ ] Tag normalization is consistent across manual input, local AI suggestions, and AI cleanup proposals.
- [ ] Remove noisy local AI cleanup debug logging before public beta.
- [ ] Remove stray empty branch in `reloadBookmarkManager`.
- [ ] Run final beta verification loop: full lint, unit tests, Chromium E2E, perf tests, size check.

## Validation Run

- `npx @biomejs/biome check popup/js/initBookmarkManager.js popup/js/model/bookmarkManagerData.js popup/js/model/bookmarkManagerOperations.js popup/js/model/bookmarkCleanupProposal.js popup/js/helper/localAiTags.js popup/js/view/bookmarkManagerView.js`: passed, 6 files checked.
- `npm run test:unit -- popup/js/model/__tests__/bookmarkManagerData.test.js popup/js/model/__tests__/bookmarkManagerOperations.test.js popup/js/model/__tests__/bookmarkManagerUndo.test.js popup/js/model/__tests__/bookmarkCleanupProposal.test.js popup/js/helper/__tests__/localAiTags.test.js popup/js/view/__tests__/bookmarkManagerView.test.js popup/js/view/__tests__/bookmarkManagerDuplicatesView.test.js popup/js/view/__tests__/bookmarkManagerDuplicateSelection.test.js popup/js/view/__tests__/bookmarkManagerOverviewView.test.js popup/js/view/__tests__/bookmarkManagerTagControls.test.js`: passed, 10 suites and 56 tests.
- `npm run test:e2e -- playwright/tests/bookmarkManager.spec.js`: passed, 7 Chromium Playwright tests in about 2.3 minutes.

Not rerun today: full lint, full unit suite, full E2E suite, `npm run test:perf`, `npm run size`, and real browser bookmark mutation/export/import checks.

## Release-Blocking Before Broad Beta

### AI Cleanup can delete non-duplicate bookmarks

`validateDeleteChanges` and liberal parsing only verify that `bookmarkId` and `duplicateOfBookmarkId` exist and differ. They do not verify that both bookmarks have the same normalized URL, belong to a known duplicate group, or match the manager's duplicate cleanup model. See [bookmarkCleanupProposal.js](/home/fannon/dev/search-bookmarks-history-and-tabs/popup/js/model/bookmarkCleanupProposal.js:540) and [bookmarkCleanupProposal.js](/home/fannon/dev/search-bookmarks-history-and-tabs/popup/js/model/bookmarkCleanupProposal.js:911). The apply path then calls `bookmarks.remove` directly in [initBookmarkManager.js](/home/fannon/dev/search-bookmarks-history-and-tabs/popup/js/initBookmarkManager.js:1134).

Impact: a bad local/external LLM proposal, or pasted JSON, can present an arbitrary bookmark deletion as "Delete Duplicate Bookmarks" and the parser will accept it as long as the IDs exist.

Recommendation: validate delete proposals against `managerModel.duplicateGroups` or compare normalized URLs before accepting them. Add unit tests proving that a delete proposal for different URLs is rejected/dropped with a warning.

### AI Cleanup Apply All / Accept All has no final confirmation

The cleanup UI correctly says users should review proposals, but `Apply All` and per-category `Accept All` execute immediately once clicked. The button is enabled by any parsed change count in [bookmarkManagerView.js](/home/fannon/dev/search-bookmarks-history-and-tabs/popup/js/view/bookmarkManagerView.js:788), and the handlers apply changes in [initBookmarkManager.js](/home/fannon/dev/search-bookmarks-history-and-tabs/popup/js/initBookmarkManager.js:1027) and [initBookmarkManager.js](/home/fannon/dev/search-bookmarks-history-and-tabs/popup/js/initBookmarkManager.js:1044). This includes deletes via [initBookmarkManager.js](/home/fannon/dev/search-bookmarks-history-and-tabs/popup/js/initBookmarkManager.js:1134).

Impact: one accidental click can move, rename, retag, rewrite, and delete many bookmarks. Undo snapshots mitigate this, but they are memory-only and restoring recreated deleted bookmarks may not preserve original IDs.

Recommendation: add a confirmation dialog or review modal that summarizes counts by action type and highlights destructive operations. For beta, disable `Apply All` when delete or move changes are present unless the user explicitly confirms.

## Important Beta Findings

### Bulk AI cleanup is not transactional

`applyCleanupChanges` creates one undo snapshot, then applies changes sequentially in [initBookmarkManager.js](/home/fannon/dev/search-bookmarks-history-and-tabs/popup/js/initBookmarkManager.js:1068). If change 4 of 20 fails, the first 3 are already persisted. The same pattern exists in sequential bookmark update loops.

Recommendation: track per-change success/failure and report exact applied IDs. Keep the undo snapshot, but tell the user when the result is partial and offer an immediate undo button.

### Local tag suggestions sample only 16 bookmarks

Local AI tag suggestions cap prompt input at 16 bookmarks in [localAiTags.js](/home/fannon/dev/search-bookmarks-history-and-tabs/popup/js/helper/localAiTags.js:28) and [localAiTags.js](/home/fannon/dev/search-bookmarks-history-and-tabs/popup/js/helper/localAiTags.js:92). Strict multi-select mode filters suggested tags against all selected bookmarks, but the liberal retry skips that evidence filter in [localAiTags.js](/home/fannon/dev/search-bookmarks-history-and-tabs/popup/js/helper/localAiTags.js:83).

Impact: for large selections, the second-try "broader" suggestion can be based on the first 16 bookmarks and then applied to the whole selection.

Recommendation: Don't do sample size and warn the user if they selected more than 20 bookmarks with ability to abort.

### Cleanup prompt truncates large libraries silently

Cleanup prompt payloads slice bookmark input to 2000 entries in [bookmarkCleanupProposal.js](/home/fannon/dev/search-bookmarks-history-and-tabs/popup/js/model/bookmarkCleanupProposal.js:5) and [bookmarkCleanupProposal.js](/home/fannon/dev/search-bookmarks-history-and-tabs/popup/js/model/bookmarkCleanupProposal.js:336). The generated prompt does not tell the model or user that entries were omitted.

Recommendation: Add dropdown option how many bookmarks to include, default to 1000, offer 20, 50, 100, 500, 1000, 2000, unlimited. Add a character budget guard for local LLM context windows.

### Duplicate ranking still ignores favorite score

Duplicate keep-candidate ranking uses tag count, title quality, recency, then folder depth in [bookmarkManagerData.js](/home/fannon/dev/search-bookmarks-history-and-tabs/popup/js/model/bookmarkManagerData.js:326). It does not include `customBonusScore`.

Impact: a user-favorited `+50` bookmark can still be ranked below a duplicate with more tags or a newer date.

Recommendation: add `customBonusScore` as an early duplicate ranking signal and test it.

### Tag normalization remains inconsistent

Manual tag input normalizes whitespace to spaces, while cleanup proposals normalize whitespace to hyphens. This can split equivalent concepts into separate tag groups.

Recommendation: choose one canonical tag form for all manager paths. Hyphenated lowercase tags are probably better for search-oriented inline hashtags, but the current UI should be consistent either way.

### Debug logging should be toned down

AI cleanup emits `console.debug` diagnostics in [initBookmarkManager.js](/home/fannon/dev/search-bookmarks-history-and-tabs/popup/js/initBookmarkManager.js:881). Debug logs are useful while stabilizing the Prompt API path, but noisy for a public beta.

Recommendation: Remove debug logging, consider improving the UI feedback for waiting for local LLM to complete?

### Stray empty branch should be cleaned

`reloadBookmarkManager` contains an empty `if (!preservedSelection) {}` block in [initBookmarkManager.js](/home/fannon/dev/search-bookmarks-history-and-tabs/popup/js/initBookmarkManager.js:167). It is harmless, but should be removed.

## Test Gaps To Add

- AI cleanup delete validation rejects different-URL bookmark pairs and only accepts known duplicate groups.
- `Apply All` / category apply confirmation behavior, especially when proposed changes include deletes or moves.
- Partial failure handling for cleanup/bulk tag/move/delete loops, including status text and undo availability.
- Local AI multi-select suggestion behavior with more than 16 selected bookmarks, including liberal retry.
- Cleanup prompt truncation and prompt-size display for libraries above 2000 bookmarks or above a character budget.
- Duplicate ranking respects `customBonusScore`.
- Real bookmark API E2E or manual matrix for `bookmarks.update`, `bookmarks.move`, `bookmarks.remove`, `bookmarks.create`, undo restore, bookmark export/import, and API-unavailable fallback.
- Browser matrix for Chrome, Edge, Firefox: manager load, passive read-only states, mutation actions, local AI unavailable/downloadable states.
- Accessibility checks for tabs, folder tree, duplicate checkboxes, cleanup proposal actions, file import button, focus order, and screen-reader labels.
- Performance regression check for a large bookmark library after AI cleanup and manager view changes: run `npm run test:perf`.

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

For an internal beta: proceed, with backup/export guidance kept prominent.

For a public beta: first fix AI cleanup duplicate-delete validation and add a final confirmation/dry-run summary for bulk cleanup apply. Then run full lint, full unit tests, full Chromium E2E, perf tests, size check, and a small real-browser mutation/export/import matrix.
