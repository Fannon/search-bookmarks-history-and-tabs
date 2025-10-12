# Options Form Redesign Spec

## Summary

- Replace the YAML textarea on the options page with a compact, schema-driven form that guides non-technical users.
- Describe options metadata in a separate JSON Schema file (`optionsSchema.js`) (draft-07) so we can validate inputs, render controls, and keep default values centralized alongside `defaultOptions` in `popup/js/model/options.js#L6`. The JSON Schema file should only be loaded when options are updated and need to be validated.
- Persist only user overrides in storage; if a value matches the default it should not be written, so future default changes are picked up automatically.
- Keep bundle size small by isolating all options-only code under a new `popup/js/options/` namespace that is only imported by `popup/options.html`.

## Current State

- `popup/options.html#L18-L64` renders a bare `<textarea>` backed by `js-yaml`, which intimidates non-developers and offers no validation or documentation.
- `popup/js/view/editOptionsView.js#L7-L39` loads/saves YAML verbatim and writes the full object to storage, even when values equal the defaults.
- `popup/js/model/options.js#L6-L344` defines defaults and exports storage helpers; it has zero knowledge about UI or validation today and should remain lean.

## Goals

- Provide an intuitive, space-efficient form for all existing options groups (General, Search, Style, Sources, Display, Bookmarks, Tabs, History, Search Engines, Scores, Power Users).
- Express every option (including nested arrays/objects) in a JSON Schema with enough metadata to drive the UI.
- Validate user input against that schema before saving and show meaningful inline errors.
- Save only the deltas between form values and `defaultOptions`.
- Keep `popup/js/initSearch.bundle.min.js` bundle size low: new code should be split into modules only loaded on the options route, avoiding regressions for popup performance.

## Non-Goals

- No live preview of popup styling.
- No drag & drop re-ordering beyond what the schema already describes.
- No multi-language support changes (reuse existing English-only strings).
- No change to how the popup consumes options (still `getEffectiveOptions()` merging defaults with overrides).

## Proposed Architecture

### Schema Definition & Metadata

- Create `popup/js/options/optionsSchema.js` exporting:
  - `optionsSchema`: a JSON Schema object (Draft 7 compatible) with per-section `properties`, `definitions` for reusable shapes (e.g. search engine entries), defaults referencing `defaultOptions`, and `ui:section` metadata for layout.
  - `uiSchema`: lightweight UI hints (control type, helper copy, grouping, order).
- Re-export `defaultOptions` from `options.js` to avoid duplication; schema defaults should be imported from `defaultOptions` to ensure consistency.
- Keep schema intentionally limited to keywords we support (type, enum, minimum/maximum, minItems/maxItems, pattern, items, default, description, format). Anything more complex should move to bespoke validators to prevent scope creep.

### Form Rendering

- Introduce `popup/js/options/renderForm.js` that:
  - Traverses the schema and `uiSchema` to render controls (switches for booleans, number inputs with inline units, select/segmented controls for enums, text inputs for colors with preview chip, flexible list editors for arrays of objects).
  - Uses a responsive, two-column layout above 640px and stacked cards below, to stay compact inside the popup window.
  - Adds per-section accordions with sticky headers to keep the page navigable despite limited viewport height.
  - Provides “Reset to default” per field; toggling uses form state to revert to schema default and marks the field as non-customized.
- Add `popup/js/options/formState.js` to manage:
  - Loading defaults (`defaultOptions`) and stored overrides (`getUserOptions`).
  - Producing “effective values” for the form (defaults merged with overrides) along with a boolean map of `isCustomized`.
  - Computing diffs when fields change so we know whether a control matches the default.

### Validation

- Use the lightweight `@exodus/schemasafe` validator (≈30 KB minified) to compile `optionsSchema` at module load.
  - Add the dependency and configure esbuild bundling to tree-shake unused exports.
  - Wrap validator errors with friendly messages bound to specific form inputs.
- Enforce additional rules where schema alone cannot (e.g. “maxRecentTabsToShow” must be 0 or ≥3): implement as custom keywords registered with the validator, keeping them colocated in `validation.js`.

### Persistence Logic

- Extend `popup/js/model/options.js` minimally:
  - Export `defaultOptions` unchanged, keep `getEffectiveOptions()` logic.
  - Optionally expose a new helper `diffUserOptions(effectiveValues)` that returns `{ overrides, isDirty }` so other consumers (future settings UI) can reuse it; implement this helper in a new sibling module `popup/js/model/optionsDiff.js` to avoid bloating the existing file.
- In the options UI:
  - On save, validate form data and call `computeOverrides(formData, defaultOptions)` to strip any property (deeply) matching its default; arrays/objects count as customized if they differ structurally.
  - Persist only the resulting overrides via `setUserOptions(overrides)`.
  - If overrides object is empty, clear storage by passing `{}` to maintain current behavior.
- Ensure array comparisons are order-sensitive: if a user tweaks a search engine entry the entire array is flagged as customized.

### Migration Strategy

- On first load of the new form:
  - Fetch existing `userOptions`. They may have been authored in YAML but are stored as plain objects, so no transformation is required.
  - Attempt to validate against the new schema; if validation fails, surface all errors in a dismissible banner and keep values editable.
  - Provide a secondary action “Download current overrides (YAML)” using the legacy `js-yaml` only when needed and behind a dynamic import, so power users can backup before fixing validation issues.
- Remove the `js-yaml` `<script>` tag from `popup/options.html` and delete `popup/js/view/editOptionsView.js` once the new UI is in place.

### UI/UX Details

- Header summary showing number of customized fields and a “Reset all to defaults” button.
- Section cards:
  - General search & style options: grouped into toggles and sliders.
  - List-heavy sections (Search Engines, Custom Engines): table-like editor with add/remove buttons; show compact badges for aliases.
  - Power-user JSON inputs (e.g. `uFuzzyOptions`): toggleable advanced editor rendered as a code textarea with JSON validation; highlight schema-subset enforcement.
- Each control displays inline help text derived from `description` in schema (shortened to fit).
- Inline error states show under fields; summary banner at top lists first three errors with anchor links.

### Module Loading & Build

- Update `popup/options.html` to load a freshly created entry point `popup/js/options/initFormOptions.js` instead of `initOptions.js`.
  - This new entry should dynamically import heavy modules (`renderForm.js`, `schemasafe`) to keep initial parse minimal.
- Update `bin/bundle.js` (if necessary) to include the new entry while excluding removed scripts.
- Ensure tree shaking removes unused defaults; run `npm run size` before/after to verify bundle impact.

### Testing Plan

- Unit tests:
  - `popup/js/options/__tests__/formState.test.js` covering diff computation, reset to defaults, and customized detection.
  - `popup/js/options/__tests__/validation.test.js` validating edge cases (min/max, enums, nested objects).
- Integration/UI tests (Jest + jsdom):
  - Render the schema and simulate user interactions to ensure controls sync with state.
- Playwright regression:
  - Update or add a spec exercising the options page: toggle a setting, save, reopen, ensure only changed values persist.
- Snapshot of overrides storage to assert only dirty fields are stored.

### Risks & Mitigations

- **Bundle bloat**: monitor esbuild output; consider building a shared vendor chunk for `schemasafe` if needed.
- **Schema drift**: write CI assertion that every key in `defaultOptions` is present in the schema and vice versa; fail build otherwise.
- **Complex arrays**: if the UI becomes unwieldy for search engines, keep an “Advanced JSON editor” fallback limited to those sections, but still validated by the schema.

## Open Questions

- Should we retain an “Export YAML” feature for power users? (Default proposal: provide as optional utility via lazy-loaded `js-yaml`.)
- Are there options that should be hidden behind an “Advanced” accordion by default to reduce visual noise?

## Next Steps

1. Finalize schema structure and pick any additional UI metadata we require.
2. Prototype the renderer for a single section to validate layout within popup constraints.
3. Implement validation/diff helpers and cover with unit tests.
4. Replace the options entry point, remove YAML editor artifacts, and update build configuration.
5. Update docs (README/Tips) to reference the new form-based editor once the implementation ships.
