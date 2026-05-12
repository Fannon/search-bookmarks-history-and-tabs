/**
 * @file Prompt, schema, and validation helpers for AI bookmark cleanup proposals.
 */

import { normalizeTagName } from './bookmarkManagerOperations.js'

const DEFAULT_PROMPT_BOOKMARK_LIMIT = 1000
const PROMPT_BOOKMARK_TEXT_BUDGET = 80000
const PROMPT_TEXT_LIMIT = 180
const PROMPT_FULL = 'full'
const PROMPT_LITE = 'lite'
const STRING_SCHEMA = { type: 'string' }
const STRING_ARRAY_SCHEMA = { type: 'array', items: STRING_SCHEMA }
const OBJECT_SCHEMA_BASE = { type: 'object', additionalProperties: false }

function createChangeSchema(required, properties) {
  return {
    ...OBJECT_SCHEMA_BASE,
    required,
    properties: {
      id: STRING_SCHEMA,
      ...properties,
      reason: STRING_SCHEMA,
    },
  }
}

function createChangeProperties() {
  return {
    addTags: {
      type: 'array',
      items: createChangeSchema(['id', 'bookmarkId', 'tags'], {
        bookmarkId: STRING_SCHEMA,
        tags: STRING_ARRAY_SCHEMA,
      }),
    },
    removeTags: {
      type: 'array',
      items: createChangeSchema(['id', 'bookmarkId', 'tags'], {
        bookmarkId: STRING_SCHEMA,
        tags: STRING_ARRAY_SCHEMA,
      }),
    },
    renameTags: {
      type: 'array',
      items: createChangeSchema(['id', 'from', 'to'], {
        from: STRING_SCHEMA,
        to: STRING_SCHEMA,
      }),
    },
    moveBookmarks: {
      type: 'array',
      items: createChangeSchema(['id', 'bookmarkId', 'targetFolderId'], {
        bookmarkId: STRING_SCHEMA,
        targetFolderId: STRING_SCHEMA,
      }),
    },
    deleteBookmarks: {
      type: 'array',
      items: createChangeSchema(['id', 'bookmarkId', 'duplicateOfBookmarkId'], {
        bookmarkId: STRING_SCHEMA,
        duplicateOfBookmarkId: STRING_SCHEMA,
      }),
    },
    rewriteTitles: {
      type: 'array',
      items: createChangeSchema(['id', 'bookmarkId', 'title'], {
        bookmarkId: STRING_SCHEMA,
        title: STRING_SCHEMA,
      }),
    },
  }
}

export const localAiBookmarkCleanupProposalSchema = {
  ...OBJECT_SCHEMA_BASE,
  required: ['summary', 'changes'],
  properties: {
    summary: STRING_SCHEMA,
    changes: {
      ...OBJECT_SCHEMA_BASE,
      properties: createChangeProperties(),
    },
  },
}

/**
 * Build the prompt shown to users and sent to local AI.
 *
 * @param {Object} managerModel Bookmark manager model.
 * @param {'lite'|'full'} [mode='full'] Prompt detail mode.
 * @param {Object} [options] Prompt options.
 * @param {string|number} [options.changeLimit=50] Maximum proposed changes, or 'unlimited'.
 * @param {'everything'|'tags'|'title'|'folder'|'duplicates'} [options.changeFocus='everything'] Change type focus.
 * @param {string|number} [options.bookmarkLimit=1000] Maximum bookmark rows to include, or 'unlimited'.
 * @returns {string} Prompt text.
 */
export function createBookmarkCleanupPrompt(managerModel, mode = PROMPT_FULL, options = {}) {
  const isLite = mode === PROMPT_LITE
  const changeLimit = normalizePromptChangeLimit(options.changeLimit)
  const changeFocus = normalizePromptChangeFocus(options.changeFocus)
  const allowedChangeTypes = getAllowedPromptChangeTypes(isLite, changeFocus)
  const needsFolders = allowedChangeTypes.includes('moveBookmarks')
  const payload = createBookmarkCleanupPromptPayload(managerModel, {
    bookmarkLimit: options.bookmarkLimit,
    includeFolders: needsFolders,
  })

  return `
## Role
${getPromptPersona(isLite)}

## Task
Propose practical, reviewable bookmark cleanup changes using the bookmark data provided at the end of this prompt.

## Evidence Policy
- Primary evidence: each bookmark's title, URL, folder path, and current tags.
- Secondary evidence: the list of existing tags with usage counts shows the user's naming conventions.
- World knowledge: use common web and domain knowledge only to confirm patterns already visible in the bookmark data. Do not infer niche details, repository contents, package purposes, or product categories not evident from the title, URL, folder, or tags.

## Decision Policy
${formatPromptChangeLimit(changeLimit)}
- Use stricter confidence for higher-risk changes: deleteBookmarks requires very high confidence, moveBookmarks and renameTags require high confidence.
- For addTags and rewriteTitles, medium confidence is acceptable when the title, URL, domain, folder, current tags, or existing tag patterns provide clear reviewable evidence.
- Prefer no change over a weak or speculative change, especially for destructive or structural changes.
- Do not optimize for the number of changes. When many bookmarks are untagged, sparsely tagged, or have noisy titles, return a focused batch of the best reviewable addTags and rewriteTitles suggestions.
${formatPromptFocusInstruction(isLite, changeFocus, allowedChangeTypes)}
Bookmark context: included ${payload.includedBookmarkCount} of ${payload.totalBookmarkCount} bookmark${payload.totalBookmarkCount === 1 ? '' : 's'}.${payload.omittedBookmarkCount ? ` Omitted ${payload.omittedBookmarkCount} due to the selected bookmark/context limit.` : ''}${payload.truncatedByCharacterBudget ? ` Stopped at the ${PROMPT_BOOKMARK_TEXT_BUDGET} character bookmark-context budget.` : ''}

## Rules by Change Type
- Use only bookmark IDs from the provided data.
- If unsure about a required field, omit that change instead of using placeholders.
- Include reason when it adds useful review context. For medium-confidence addTags, the reason should name the evidence: title, URL path, domain, folder, current tags, or existing tag pattern.
- Keep summary to one short sentence.
${formatPromptGoals(isLite, allowedChangeTypes)}
${formatPromptRules(isLite, allowedChangeTypes)}

## Output Requirements
- Output raw JSON only. Do not include introductory text, conversational filler, comments, or markdown formatting. Do not wrap the output in code fences such as \`\`\`json.
- The first character of your response must be "{" and the last character must be "}".
- Output base shape: {"summary":"","changes":{}}
- Omit every change type key that has no proposals. Do not output empty arrays.
${createPromptExample(allowedChangeTypes)}

## Internal Self-Check
Before finalizing, verify:
1. Valid JSON: no trailing commas, all property names double-quoted, braces balanced.
2. Every change type that has proposals is included; every empty array is omitted.
3. Every change object has all required fields (id, bookmarkId, and tags/title/from/to/targetFolderId/duplicateOfBookmarkId as applicable).
4. Every bookmarkId exists in the provided bookmark data.
5. Every targetFolderId exists in the existing folder list.
6. The first character is "{" and the last character is "}".

## Input Data

Existing tags (with usage counts):
${payload.existingTags}

${needsFolders ? `Existing folders:\n${payload.existingFolders}\n` : ''}
Bookmarks, one per line as: ${needsFolders ? 'id | title | url | folderId | folderPath | tags' : 'id | title | url | tags'}
${payload.bookmarks}
  `.trim()
}

/**
 * Create compact bookmark manager data for prompt input.
 *
 * @param {Object} managerModel Bookmark manager model.
 * @param {Object} [options] Payload options.
 * @param {string|number} [options.bookmarkLimit=1000] Maximum bookmark rows to include, or 'unlimited'.
 * @param {boolean} [options.includeFolders=true] Include folder fields and folder list.
 * @returns {Object} Prompt payload.
 */
export function createBookmarkCleanupPromptPayload(managerModel, options = {}) {
  const bookmarks = managerModel?.bookmarks || []
  const folderOptions = managerModel?.folderOptions || []
  const tagGroups = managerModel?.tagGroups || []
  const bookmarkLimit = normalizePromptBookmarkLimit(options.bookmarkLimit)
  const includeFolders = options.includeFolders !== false
  const bookmarkPayload = createBookmarkPromptRows(bookmarks, includeFolders, bookmarkLimit)

  return {
    bookmarks: bookmarkPayload.bookmarks,
    includedBookmarkCount: bookmarkPayload.includedBookmarkCount,
    omittedBookmarkCount: bookmarkPayload.omittedBookmarkCount,
    totalBookmarkCount: bookmarks.length,
    truncatedByCharacterBudget: bookmarkPayload.truncatedByCharacterBudget,
    existingTags: tagGroups.map((tag) => `${tag.name} (${tag.count})`).join(', '),
    existingFolders: folderOptions
      .map((folder) => `${folder.id} | ${folder.label || folder.title || folder.id}`)
      .join('\n'),
  }
}

function createBookmarkPromptRows(bookmarks, includeFolders, bookmarkLimit) {
  const maxBookmarks = bookmarkLimit ? Math.min(bookmarkLimit, bookmarks.length) : bookmarks.length
  const formatBookmark = includeFolders ? formatBookmarkForPrompt : formatBookmarkForLitePrompt
  const rows = []
  let textLength = 0
  let truncatedByCharacterBudget = false

  for (let i = 0; i < maxBookmarks; i++) {
    const row = formatBookmark(bookmarks[i])
    const nextLength = textLength + row.length + (rows.length ? 1 : 0)
    if (nextLength > PROMPT_BOOKMARK_TEXT_BUDGET) {
      truncatedByCharacterBudget = true
      break
    }
    rows.push(row)
    textLength = nextLength
  }

  return {
    bookmarks: rows.join('\n'),
    includedBookmarkCount: rows.length,
    omittedBookmarkCount: bookmarks.length - rows.length,
    truncatedByCharacterBudget,
  }
}

function getPromptPersona(isLite) {
  return isLite
    ? 'Act as a careful browser bookmark curator focused on practical tag cleanup and concise, descriptive titles.'
    : 'Act as a careful browser bookmark curator focused on practical tag cleanup, duplicate detection, concise titles, and conservative folder organization.'
}

function normalizePromptChangeLimit(changeLimit) {
  if (changeLimit === 'unlimited') {
    return 0
  }

  const limit = Number.parseInt(changeLimit || 100, 10)
  return Number.isFinite(limit) && limit > 0 ? limit : 100
}

function formatPromptChangeLimit(changeLimit) {
  if (!changeLimit) {
    return ''
  }

  return `Use ${changeLimit} as a safety ceiling, not a quota. Do not force changes to fill the limit; if there are only 10 good improvements, return only 10. For addTags and rewriteTitles, prefer a useful review batch of the strongest suggestions up to the limit.`
}

function normalizePromptBookmarkLimit(bookmarkLimit) {
  if (bookmarkLimit === 'unlimited') {
    return 0
  }

  const limit = Number.parseInt(bookmarkLimit || DEFAULT_PROMPT_BOOKMARK_LIMIT, 10)
  return Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_PROMPT_BOOKMARK_LIMIT
}

function normalizePromptChangeFocus(changeFocus) {
  if (changeFocus === 'tags' || changeFocus === 'title' || changeFocus === 'folder' || changeFocus === 'duplicates') {
    return changeFocus
  }
  return 'everything'
}

function getAllowedPromptChangeTypes(isLite, changeFocus) {
  if (changeFocus === 'tags') {
    return ['addTags', 'removeTags', 'renameTags']
  }
  if (changeFocus === 'title') {
    return ['rewriteTitles']
  }
  if (changeFocus === 'folder') {
    return ['moveBookmarks']
  }
  if (changeFocus === 'duplicates') {
    return isLite ? [] : ['deleteBookmarks']
  }
  return isLite
    ? ['addTags', 'removeTags', 'renameTags', 'rewriteTitles']
    : ['addTags', 'removeTags', 'renameTags', 'moveBookmarks', 'deleteBookmarks', 'rewriteTitles']
}

function formatPromptGoals(isLite, allowedChangeTypes) {
  const goals = []

  if (allowedChangeTypes.includes('addTags')) {
    goals.push(
      '- addTags: Add useful, concise, lowercase tags when supported by title, URL structure, domain, folder, current tags, or existing collection tag patterns. Strongly prefer tags that already exist in the collection unless the bookmark clearly needs a broadly reusable new tag. For already-tagged bookmarks, suggest at most 1–2 new tags. For bookmarks with no tags, suggest at most 1–3 fundamental tags (e.g. "github", "docs", "reference") when the evidence is clear enough for quick human review. Do not add a tag simply because a word appears in the title.',
    )
  }
  if (allowedChangeTypes.includes('removeTags')) {
    goals.push(
      '- removeTags: Remove a tag only when it is misleading, incorrect, or a clearly poor fit for the bookmark. Do not remove tags merely because they are generic or redundant; tags may intentionally improve search scoring as keywords.',
    )
  }
  if (allowedChangeTypes.includes('renameTags')) {
    goals.push(
      '- renameTags: Use one renameTags entry per source tag being renamed or merged. Example: to merge "genai" and "llm" into "ai", create two separate entries — one from "genai" to "ai", one from "llm" to "ai". Only rename when the replacement is clearly better aligned with the collection\'s naming convention. Mutually exclusive: if you use renameTags, do not also add/remove the same tag in addTags/removeTags.',
    )
  }
  if (allowedChangeTypes.includes('moveBookmarks')) {
    goals.push(
      '- moveBookmarks: Move a bookmark only when the target folder is clearly more specific or clearly more accurate than the current folder. Do not propose a move when the current folder is already reasonable. Use only folder IDs from the provided existing folder list. Do not invent folders.',
    )
  }
  if (allowedChangeTypes.includes('deleteBookmarks')) {
    goals.push(
      '- deleteBookmarks: Delete only exact or near-exact duplicate bookmarks. When in doubt, do not propose deletion. Both must share the same canonical URL or differ only by tracking parameters, URL fragments, or minor URL variants. Every entry must include duplicateOfBookmarkId identifying the bookmark to keep. Never delete related pages, alternate documentation versions, mirrors, forks, language variants, or product pages that serve different purposes.',
    )
  }
  if (allowedChangeTypes.includes('rewriteTitles')) {
    goals.push(
      '- rewriteTitles: Be conservative. Do not rewrite short, clear, or already useful titles. Rewrite when the current title is very long, noisy, duplicated boilerplate, truncated, or looks like an unedited webpage title that harms search or review quality. A medium-confidence improvement is acceptable only when the cleaner title can be derived from the existing title and URL. Do not rewrite for style alone. Strip boilerplate prefixes (e.g. "GitHub - owner/repo: description" → "owner/repo — description", "npm: package-name" → "package-name — npm package", "Home | Vendor Product" → "Vendor Product"). Preserve distinctive project, repository, package, and product identifiers. Do not add inferred categories, folder names, scores, domains, or subjective adjectives to rewritten titles.',
    )
  }
  if (isLite && hasAnyAllowedType(allowedChangeTypes, ['addTags', 'removeTags', 'renameTags', 'rewriteTitles'])) {
    goals.push('- Do not propose bookmark moves or deletions.')
  }
  if (isLite && allowedChangeTypes.length > 1) {
    goals.push(
      '- Focus on addTags and rewriteTitles first. Use removeTags and renameTags only when clearly beneficial.',
    )
  }
  if (!goals.length) {
    goals.push('- No change types are available in this mode. Return an empty changes object.')
  }

  return goals.join('\n')
}

function formatPromptRules(isLite, allowedChangeTypes) {
  const rules = []

  if (allowedChangeTypes.includes('deleteBookmarks')) {
    rules.push('- Do not delete a bookmark unless duplicateOfBookmarkId identifies the bookmark to keep.')
    rules.push('- For deleteBookmarks, URLs must be canonical duplicates or tracking/fragment variants.')
  }
  if (isLite && !allowedChangeTypes.includes('moveBookmarks')) {
    rules.push('- Keep moveBookmarks empty.')
  }
  if (isLite && !allowedChangeTypes.includes('deleteBookmarks')) {
    rules.push('- Keep deleteBookmarks empty.')
  }

  return rules.join('\n')
}

function hasAnyAllowedType(allowedChangeTypes, types) {
  for (let i = 0; i < types.length; i++) {
    if (allowedChangeTypes.includes(types[i])) {
      return true
    }
  }
  return false
}

function formatPromptFocusInstruction(isLite, changeFocus, allowedChangeTypes) {
  if (isLite && changeFocus === 'duplicates') {
    return 'Change type focus: Duplicates. Lite mode does not include duplicate-cleanup context, so return an empty changes object. Use Advanced for duplicate proposals.'
  }

  const label =
    changeFocus === 'tags'
      ? 'Tags'
      : changeFocus === 'title'
        ? 'Title'
        : changeFocus === 'folder'
          ? 'Folder Structure'
          : changeFocus === 'duplicates'
            ? 'Duplicates'
            : 'Everything'
  return `Change type focus: ${label}. Include only these change arrays when they have proposals: ${allowedChangeTypes.join(', ')}. Omit other change arrays.`
}

function createPromptExample(allowedChangeTypes) {
  const changes = {}

  if (allowedChangeTypes.includes('addTags')) {
    changes.addTags = [{ id: 'add-1', bookmarkId: 'bookmark-id-from-data', tags: ['example-tag'] }]
  }
  if (allowedChangeTypes.includes('removeTags')) {
    changes.removeTags = [
      {
        id: 'remove-1',
        bookmarkId: 'bookmark-id-from-data',
        tags: ['old-tag'],
      },
    ]
  }
  if (allowedChangeTypes.includes('renameTags')) {
    changes.renameTags = [{ id: 'rename-1', from: 'old-tag', to: 'better-tag' }]
  }
  if (allowedChangeTypes.includes('moveBookmarks')) {
    changes.moveBookmarks = [
      {
        id: 'move-1',
        bookmarkId: 'bookmark-id-from-data',
        targetFolderId: 'folder-id-from-data',
      },
    ]
  }
  if (allowedChangeTypes.includes('deleteBookmarks')) {
    changes.deleteBookmarks = [
      {
        id: 'delete-1',
        bookmarkId: 'duplicate-bookmark-id',
        duplicateOfBookmarkId: 'bookmark-id-to-keep',
      },
    ]
  }
  if (allowedChangeTypes.includes('rewriteTitles')) {
    changes.rewriteTitles = [
      {
        id: 'rewrite-1',
        bookmarkId: 'bookmark-id-from-data',
        title: 'Clear Bookmark Title',
      },
    ]
  }

  return `Example output format only. Do not copy example IDs; use IDs from the provided data:\n${JSON.stringify({
    summary: 'Short summary.',
    changes,
  })}`
}

/**
 * Parse and validate cleanup proposal JSON.
 *
 * @param {string} jsonText Raw JSON.
 * @param {Object} managerModel Bookmark manager model.
 * @returns {Object} Normalized proposal.
 */
export function parseBookmarkCleanupProposal(jsonText, managerModel) {
  let proposal
  try {
    proposal = JSON.parse(jsonText)
  } catch (error) {
    throw new Error(`Cleanup proposal is not valid JSON: ${error.message}`)
  }

  const errors = validateBookmarkCleanupProposal(proposal, managerModel)
  if (errors.length) {
    throw new Error(errors.join('\n'))
  }

  return normalizeBookmarkCleanupProposal(proposal)
}

/**
 * Parse cleanup proposal JSON and keep valid entries while reporting issues.
 *
 * @param {string} jsonText Raw JSON.
 * @param {Object} managerModel Bookmark manager model.
 * @returns {{proposal: Object|null, errors: Array<string>, warnings: Array<string>}}
 */
export function parseBookmarkCleanupProposalWithIssues(jsonText, managerModel) {
  let proposal
  try {
    proposal = JSON.parse(jsonText)
  } catch (error) {
    return {
      proposal: null,
      errors: [`Cleanup proposal is not valid JSON: ${error.message}`],
      warnings: [],
    }
  }

  const errors = []
  const warnings = []
  if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal)) {
    return {
      proposal: null,
      errors: ['Cleanup proposal must be a JSON object.'],
      warnings,
    }
  }
  if (!proposal.changes || typeof proposal.changes !== 'object' || Array.isArray(proposal.changes)) {
    return {
      proposal: null,
      errors: ['Cleanup proposal must include a changes object.'],
      warnings,
    }
  }

  return {
    proposal: normalizeBookmarkCleanupProposalWithIssues(proposal, managerModel, warnings),
    errors,
    warnings,
  }
}

/**
 * Validate a cleanup proposal against known bookmark manager data.
 *
 * @param {Object} proposal Parsed proposal.
 * @param {Object} managerModel Bookmark manager model.
 * @returns {Array<string>} Validation errors.
 */
export function validateBookmarkCleanupProposal(proposal, managerModel) {
  const errors = []
  const changes = proposal?.changes

  if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal)) {
    return ['Cleanup proposal must be a JSON object.']
  }
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
    errors.push('Cleanup proposal must include a changes object.')
    return errors
  }

  const bookmarkIds = new Set((managerModel?.bookmarks || []).map((bookmark) => String(bookmark.originalId)))
  const folderIds = new Set((managerModel?.folderOptions || []).map((folder) => String(folder.id)))
  const existingTags = new Set()

  for (const group of managerModel?.tagGroups || []) {
    existingTags.add(group.name.toLowerCase())
  }

  validateTagChanges(errors, changes.addTags, 'addTags', bookmarkIds)
  validateTagChanges(errors, changes.removeTags, 'removeTags', bookmarkIds)
  validateRenameTagChanges(errors, changes.renameTags, existingTags, bookmarkIds)
  validateMoveChanges(errors, changes.moveBookmarks, bookmarkIds, folderIds)
  validateDeleteChanges(errors, changes.deleteBookmarks, bookmarkIds, managerModel)
  validateRewriteTitleChanges(errors, changes.rewriteTitles, bookmarkIds)

  return errors
}

/**
 * Return total number of proposal changes.
 *
 * @param {Object} proposal Cleanup proposal.
 * @returns {number} Change count.
 */
export function countBookmarkCleanupChanges(proposal) {
  const changes = proposal?.changes || {}
  return (
    (changes.addTags?.length || 0) +
    (changes.removeTags?.length || 0) +
    (changes.renameTags?.length || 0) +
    (changes.moveBookmarks?.length || 0) +
    (changes.deleteBookmarks?.length || 0) +
    (changes.rewriteTitles?.length || 0)
  )
}

/**
 * Create final confirmation text for applying multiple cleanup changes.
 *
 * @param {Array<{type: string, change: Object}>} changes Cleanup changes.
 * @returns {string} Confirmation text.
 */
export function createBookmarkCleanupApplyConfirmation(changes = []) {
  const counts = countCleanupChangeTypes(changes)
  const lines = [
    `Apply ${changes.length} bookmark cleanup change${changes.length === 1 ? '' : 's'}?`,
    '',
    `Add tags: ${counts.addTags}`,
    `Remove tags: ${counts.removeTags}`,
    `Rename tags: ${counts.renameTags}`,
    `Move bookmarks: ${counts.moveBookmarks}`,
    `Rewrite titles: ${counts.rewriteTitles}`,
    `Delete bookmarks: ${counts.deleteBookmarks}`,
  ]

  if (counts.moveBookmarks || counts.deleteBookmarks) {
    lines.push('', 'This includes destructive or structural bookmark changes. Export bookmarks first if unsure.')
  }

  lines.push('', 'Undo history is memory-only and disappears when this page closes or reloads.')
  return lines.join('\n')
}

function formatBookmarkForLitePrompt(bookmark) {
  return [
    String(bookmark.originalId),
    limitPromptText(bookmark.title || ''),
    limitPromptText(bookmark.originalUrl || bookmark.url || ''),
    (bookmark.tagsArray || []).join(', '),
  ].join(' | ')
}

function formatBookmarkForPrompt(bookmark) {
  return [
    String(bookmark.originalId),
    limitPromptText(bookmark.title || ''),
    limitPromptText(bookmark.originalUrl || bookmark.url || ''),
    String(bookmark.folderId || ''),
    limitPromptText((bookmark.folderArray || []).join(' / ')),
    (bookmark.tagsArray || []).join(', '),
  ].join(' | ')
}

function validateTagChanges(errors, changes, name, bookmarkIds) {
  if (typeof changes === 'undefined') {
    return
  }
  if (!Array.isArray(changes)) {
    errors.push(`changes.${name} must be an array.`)
    return
  }

  for (let i = 0; i < changes.length; i++) {
    const change = changes[i]
    validateChangeBase(errors, change, name, i)
    if (!bookmarkIds.has(String(change?.bookmarkId))) {
      errors.push(`changes.${name}[${i}].bookmarkId does not match an existing bookmark.`)
    }
    if (!Array.isArray(change?.tags) || !change.tags.length) {
      errors.push(`changes.${name}[${i}].tags must contain at least one tag.`)
    }
  }
}

function validateRenameTagChanges(errors, changes, existingTags, bookmarkIds) {
  if (typeof changes === 'undefined') {
    return
  }
  if (!Array.isArray(changes)) {
    errors.push('changes.renameTags must be an array.')
    return
  }

  for (let i = 0; i < changes.length; i++) {
    const change = changes[i]
    validateChangeBase(errors, change, 'renameTags', i)
    if (!existingTags.has(String(change?.from || '').toLowerCase())) {
      errors.push(`changes.renameTags[${i}].from source tag does not match an existing tag.`)
    }
    if (!normalizePromptTag(change?.to)) {
      errors.push(`changes.renameTags[${i}].to must be a tag name.`)
    }
    if (Array.isArray(change?.bookmarkIds)) {
      for (let j = 0; j < change.bookmarkIds.length; j++) {
        if (!bookmarkIds.has(String(change.bookmarkIds[j]))) {
          errors.push(`changes.renameTags[${i}].bookmarkIds[${j}] does not match an existing bookmark.`)
        }
      }
    }
  }
}

function validateMoveChanges(errors, changes, bookmarkIds, folderIds) {
  if (typeof changes === 'undefined') {
    return
  }
  if (!Array.isArray(changes)) {
    errors.push('changes.moveBookmarks must be an array.')
    return
  }

  for (let i = 0; i < changes.length; i++) {
    const change = changes[i]
    validateChangeBase(errors, change, 'moveBookmarks', i)
    if (!bookmarkIds.has(String(change?.bookmarkId))) {
      errors.push(`changes.moveBookmarks[${i}].bookmarkId does not match an existing bookmark.`)
    }
    if (!folderIds.has(String(change?.targetFolderId))) {
      errors.push(`changes.moveBookmarks[${i}].targetFolderId does not match an existing folder.`)
    }
  }
}

function validateDeleteChanges(errors, changes, bookmarkIds, managerModel) {
  if (typeof changes === 'undefined') {
    return
  }
  if (!Array.isArray(changes)) {
    errors.push('changes.deleteBookmarks must be an array.')
    return
  }

  for (let i = 0; i < changes.length; i++) {
    const change = changes[i]
    validateChangeBase(errors, change, 'deleteBookmarks', i)
    if (!bookmarkIds.has(String(change?.bookmarkId))) {
      errors.push(`changes.deleteBookmarks[${i}].bookmarkId does not match an existing bookmark.`)
      continue
    }
    if (!bookmarkIds.has(String(change?.duplicateOfBookmarkId))) {
      errors.push(`changes.deleteBookmarks[${i}].duplicateOfBookmarkId does not match an existing bookmark.`)
      continue
    }
    if (String(change?.bookmarkId) === String(change?.duplicateOfBookmarkId)) {
      errors.push(`changes.deleteBookmarks[${i}] cannot delete and keep the same bookmark.`)
    } else if (!isDuplicateBookmarkPair(change?.bookmarkId, change?.duplicateOfBookmarkId, managerModel)) {
      errors.push(`changes.deleteBookmarks[${i}] must reference bookmarks from the same duplicate URL group.`)
    }
  }

  validateDeleteChangesLeaveDuplicateSurvivors(errors, changes, managerModel)
}

function validateRewriteTitleChanges(errors, changes, bookmarkIds) {
  if (typeof changes === 'undefined') {
    return
  }
  if (!Array.isArray(changes)) {
    errors.push('changes.rewriteTitles must be an array.')
    return
  }

  for (let i = 0; i < changes.length; i++) {
    const change = changes[i]
    validateChangeBase(errors, change, 'rewriteTitles', i)
    if (!bookmarkIds.has(String(change?.bookmarkId))) {
      errors.push(`changes.rewriteTitles[${i}].bookmarkId does not match an existing bookmark.`)
    }
    if (!normalizePromptTitle(change?.title)) {
      errors.push(`changes.rewriteTitles[${i}].title must be a bookmark title.`)
    }
  }
}

function validateChangeBase(errors, change, name, index) {
  if (!change || typeof change !== 'object' || Array.isArray(change)) {
    errors.push(`changes.${name}[${index}] must be an object.`)
    return
  }
  if (!String(change.id || '').trim()) {
    errors.push(`changes.${name}[${index}].id is required.`)
  }
}

function normalizeBookmarkCleanupProposal(proposal) {
  return {
    summary: String(proposal.summary || '').trim(),
    changes: {
      addTags: normalizeTagChanges(proposal.changes.addTags || []),
      removeTags: normalizeTagChanges(proposal.changes.removeTags || []),
      renameTags: (proposal.changes.renameTags || []).map((change) => ({
        id: String(change.id).trim(),
        from: normalizePromptTag(change.from),
        to: normalizePromptTag(change.to),
        bookmarkIds: Array.isArray(change.bookmarkIds) ? change.bookmarkIds.map((id) => String(id)) : [],
        reason: String(change.reason || '').trim(),
      })),
      moveBookmarks: (proposal.changes.moveBookmarks || []).map((change) => ({
        id: String(change.id).trim(),
        bookmarkId: String(change.bookmarkId),
        targetFolderId: String(change.targetFolderId),
        targetFolderPath: String(change.targetFolderPath || '').trim(),
        reason: String(change.reason || '').trim(),
      })),
      deleteBookmarks: (proposal.changes.deleteBookmarks || []).map((change) => ({
        id: String(change.id).trim(),
        bookmarkId: String(change.bookmarkId),
        duplicateOfBookmarkId: String(change.duplicateOfBookmarkId),
        reason: String(change.reason || '').trim(),
      })),
      rewriteTitles: (proposal.changes.rewriteTitles || []).map((change) => ({
        id: String(change.id).trim(),
        bookmarkId: String(change.bookmarkId),
        title: normalizePromptTitle(change.title),
        reason: String(change.reason || '').trim(),
      })),
    },
  }
}

function normalizeBookmarkCleanupProposalWithIssues(proposal, managerModel, warnings) {
  const bookmarkIds = new Set((managerModel?.bookmarks || []).map((bookmark) => String(bookmark.originalId)))
  const folderIds = new Set((managerModel?.folderOptions || []).map((folder) => String(folder.id)))
  const existingTags = new Set((managerModel?.tagGroups || []).map((tag) => tag.name.toLowerCase()))
  const changes = proposal.changes || {}

  return {
    summary: String(proposal.summary || '').trim(),
    changes: {
      addTags: normalizeTagChangesWithIssues(changes.addTags, 'addTags', bookmarkIds, warnings),
      removeTags: normalizeTagChangesWithIssues(changes.removeTags, 'removeTags', bookmarkIds, warnings),
      renameTags: normalizeRenameTagChangesWithIssues(changes.renameTags, existingTags, bookmarkIds, warnings),
      moveBookmarks: normalizeMoveChangesWithIssues(changes.moveBookmarks, bookmarkIds, folderIds, warnings),
      deleteBookmarks: normalizeDeleteChangesWithIssues(changes.deleteBookmarks, bookmarkIds, managerModel, warnings),
      rewriteTitles: normalizeRewriteTitleChangesWithIssues(changes.rewriteTitles, bookmarkIds, warnings),
    },
  }
}

function normalizeTagChangesWithIssues(changes, name, bookmarkIds, warnings) {
  if (typeof changes === 'undefined') {
    return []
  }
  if (!Array.isArray(changes)) {
    warnings.push(`changes.${name} was not an array; treated as empty.`)
    return []
  }

  const result = []
  for (let i = 0; i < changes.length; i++) {
    const change = changes[i]
    const context = `changes.${name}[${i}]`
    if (!isProposalChangeObject(change, context, warnings)) {
      continue
    }

    const bookmarkId = String(change.bookmarkId || '')
    const tags = Array.isArray(change.tags) ? normalizePromptTags(change.tags) : []
    if (!bookmarkIds.has(bookmarkId)) {
      warnings.push(`${context} ignored because bookmarkId "${bookmarkId || 'missing'}" does not exist.`)
      continue
    }
    if (!tags.length) {
      warnings.push(`${context} ignored because it has no usable tags.`)
      continue
    }

    result.push({
      id: normalizeChangeId(change.id, name, i),
      bookmarkId,
      tags,
      reason: String(change.reason || '').trim(),
    })
  }

  return result
}

function normalizeRenameTagChangesWithIssues(changes, existingTags, bookmarkIds, warnings) {
  if (typeof changes === 'undefined') {
    return []
  }
  if (!Array.isArray(changes)) {
    warnings.push('changes.renameTags was not an array; treated as empty.')
    return []
  }

  const result = []
  for (let i = 0; i < changes.length; i++) {
    const change = changes[i]
    const context = `changes.renameTags[${i}]`
    if (!isProposalChangeObject(change, context, warnings)) {
      continue
    }

    const from = normalizePromptTag(change.from)
    const to = normalizePromptTag(change.to)
    if (!existingTags.has(from.toLowerCase())) {
      warnings.push(`${context} ignored because source tag "${from || 'missing'}" does not exist.`)
      continue
    }
    if (!to) {
      warnings.push(`${context} ignored because target tag is missing.`)
      continue
    }

    result.push({
      id: normalizeChangeId(change.id, 'renameTags', i),
      from,
      to,
      bookmarkIds: normalizeOptionalBookmarkIds(change.bookmarkIds, bookmarkIds, context, warnings),
      reason: String(change.reason || '').trim(),
    })
  }

  return result
}

function normalizeMoveChangesWithIssues(changes, bookmarkIds, folderIds, warnings) {
  if (typeof changes === 'undefined') {
    return []
  }
  if (!Array.isArray(changes)) {
    warnings.push('changes.moveBookmarks was not an array; treated as empty.')
    return []
  }

  const result = []
  for (let i = 0; i < changes.length; i++) {
    const change = changes[i]
    const context = `changes.moveBookmarks[${i}]`
    if (!isProposalChangeObject(change, context, warnings)) {
      continue
    }

    const bookmarkId = String(change.bookmarkId || '')
    const targetFolderId = String(change.targetFolderId || '')
    if (!bookmarkIds.has(bookmarkId)) {
      warnings.push(`${context} ignored because bookmarkId "${bookmarkId || 'missing'}" does not exist.`)
      continue
    }
    if (!folderIds.has(targetFolderId)) {
      warnings.push(`${context} ignored because targetFolderId "${targetFolderId || 'missing'}" does not exist.`)
      continue
    }

    result.push({
      id: normalizeChangeId(change.id, 'moveBookmarks', i),
      bookmarkId,
      targetFolderId,
      targetFolderPath: String(change.targetFolderPath || '').trim(),
      reason: String(change.reason || '').trim(),
    })
  }

  return result
}

function normalizeDeleteChangesWithIssues(changes, bookmarkIds, managerModel, warnings) {
  if (typeof changes === 'undefined') {
    return []
  }
  if (!Array.isArray(changes)) {
    warnings.push('changes.deleteBookmarks was not an array; treated as empty.')
    return []
  }

  const result = []
  for (let i = 0; i < changes.length; i++) {
    const change = changes[i]
    const context = `changes.deleteBookmarks[${i}]`
    if (!isProposalChangeObject(change, context, warnings)) {
      continue
    }

    const bookmarkId = String(change.bookmarkId || '')
    const duplicateOfBookmarkId = String(change.duplicateOfBookmarkId || '')
    if (!bookmarkIds.has(bookmarkId)) {
      warnings.push(`${context} ignored because bookmarkId "${bookmarkId || 'missing'}" does not exist.`)
      continue
    }
    if (!bookmarkIds.has(duplicateOfBookmarkId)) {
      warnings.push(
        `${context} ignored because duplicateOfBookmarkId "${duplicateOfBookmarkId || 'missing'}" does not exist.`,
      )
      continue
    }
    if (bookmarkId === duplicateOfBookmarkId) {
      warnings.push(`${context} ignored because bookmarkId and duplicateOfBookmarkId are the same.`)
      continue
    }
    if (!isDuplicateBookmarkPair(bookmarkId, duplicateOfBookmarkId, managerModel)) {
      warnings.push(`${context} ignored because the bookmarks are not in the same duplicate URL group.`)
      continue
    }

    result.push({
      id: normalizeChangeId(change.id, 'deleteBookmarks', i),
      bookmarkId,
      duplicateOfBookmarkId,
      reason: String(change.reason || '').trim(),
    })
  }

  return removeUnsafeDuplicateGroupDeletes(result, managerModel, warnings)
}

function normalizeRewriteTitleChangesWithIssues(changes, bookmarkIds, warnings) {
  if (typeof changes === 'undefined') {
    return []
  }
  if (!Array.isArray(changes)) {
    warnings.push('changes.rewriteTitles was not an array; treated as empty.')
    return []
  }

  const result = []
  for (let i = 0; i < changes.length; i++) {
    const change = changes[i]
    const context = `changes.rewriteTitles[${i}]`
    if (!isProposalChangeObject(change, context, warnings)) {
      continue
    }

    const bookmarkId = String(change.bookmarkId || '')
    const title = normalizePromptTitle(change.title)
    if (!bookmarkIds.has(bookmarkId)) {
      warnings.push(`${context} ignored because bookmarkId "${bookmarkId || 'missing'}" does not exist.`)
      continue
    }
    if (!title) {
      warnings.push(`${context} ignored because title is missing.`)
      continue
    }

    result.push({
      id: normalizeChangeId(change.id, 'rewriteTitles', i),
      bookmarkId,
      title,
      reason: String(change.reason || '').trim(),
    })
  }

  return result
}

function normalizeOptionalBookmarkIds(bookmarkIds, knownBookmarkIds, context, warnings) {
  if (!Array.isArray(bookmarkIds)) {
    return []
  }

  const result = []
  for (let i = 0; i < bookmarkIds.length; i++) {
    const bookmarkId = String(bookmarkIds[i])
    if (knownBookmarkIds.has(bookmarkId)) {
      result.push(bookmarkId)
    } else {
      warnings.push(`${context}.bookmarkIds[${i}] ignored because bookmark "${bookmarkId}" does not exist.`)
    }
  }
  return result
}

function isProposalChangeObject(change, context, warnings) {
  if (!change || typeof change !== 'object' || Array.isArray(change)) {
    warnings.push(`${context} ignored because it is not an object.`)
    return false
  }
  return true
}

function normalizeChangeId(id, category, index) {
  return String(id || `${category}-${index + 1}`).trim()
}

function normalizeTagChanges(changes) {
  return changes.map((change) => ({
    id: String(change.id).trim(),
    bookmarkId: String(change.bookmarkId),
    tags: normalizePromptTags(change.tags),
    reason: String(change.reason || '').trim(),
  }))
}

function normalizePromptTags(tags) {
  const seen = new Set()
  const result = []

  for (let i = 0; i < tags.length; i++) {
    const tag = normalizePromptTag(tags[i])
    const key = tag.toLowerCase()
    if (!tag || seen.has(key)) {
      continue
    }
    seen.add(key)
    result.push(tag)
  }

  return result
}

function normalizePromptTag(tag) {
  return normalizeTagName(tag)
}

function normalizePromptTitle(title) {
  return String(title || '')
    .replace(/(^|\s)#[^\s#]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isDuplicateBookmarkPair(bookmarkId, duplicateOfBookmarkId, managerModel) {
  const firstId = String(bookmarkId || '')
  const secondId = String(duplicateOfBookmarkId || '')
  if (!firstId || !secondId || firstId === secondId) {
    return false
  }

  const duplicateGroups = managerModel?.duplicateGroups || []
  for (let i = 0; i < duplicateGroups.length; i++) {
    const groupIds = new Set((duplicateGroups[i].bookmarks || []).map((bookmark) => String(bookmark.originalId)))
    if (groupIds.has(firstId) && groupIds.has(secondId)) {
      return true
    }
  }

  const urlsByBookmarkId = new Map()
  const bookmarks = managerModel?.bookmarks || []
  for (let i = 0; i < bookmarks.length; i++) {
    urlsByBookmarkId.set(String(bookmarks[i].originalId), normalizeDuplicateUrl(bookmarks[i]))
  }

  const firstUrl = urlsByBookmarkId.get(firstId)
  const secondUrl = urlsByBookmarkId.get(secondId)
  return Boolean(firstUrl && secondUrl && firstUrl === secondUrl)
}

function validateDeleteChangesLeaveDuplicateSurvivors(errors, changes, managerModel) {
  const deleteIds = new Set()
  for (let i = 0; i < changes.length; i++) {
    const bookmarkId = String(changes[i]?.bookmarkId || '')
    if (bookmarkId) {
      deleteIds.add(bookmarkId)
    }
  }

  const unsafeGroups = getFullyDeletedDuplicateGroups(deleteIds, managerModel)
  for (let i = 0; i < unsafeGroups.length; i++) {
    errors.push(
      `changes.deleteBookmarks would delete every bookmark in duplicate group: ${unsafeGroups[i].join(', ')}.`,
    )
  }
}

function removeUnsafeDuplicateGroupDeletes(changes, managerModel, warnings) {
  const deleteIds = new Set(changes.map((change) => String(change.bookmarkId)))
  const unsafeGroups = getFullyDeletedDuplicateGroups(deleteIds, managerModel)
  if (!unsafeGroups.length) {
    return changes
  }

  const unsafeIds = new Set()
  for (let i = 0; i < unsafeGroups.length; i++) {
    const group = unsafeGroups[i]
    warnings.push(
      `changes.deleteBookmarks ignored for duplicate group ${group.join(', ')} because it would delete every copy.`,
    )
    for (let j = 0; j < group.length; j++) {
      unsafeIds.add(group[j])
    }
  }

  return changes.filter((change) => !unsafeIds.has(String(change.bookmarkId)))
}

function getFullyDeletedDuplicateGroups(deleteIds, managerModel) {
  const result = []
  const seen = new Set()
  const groups = getDuplicateBookmarkIdGroups(managerModel)

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i]
    if (group.length < 2) {
      continue
    }
    const groupKey = group.join('\u0000')
    if (seen.has(groupKey)) {
      continue
    }
    let deletesEveryBookmark = true
    for (let j = 0; j < group.length; j++) {
      if (!deleteIds.has(group[j])) {
        deletesEveryBookmark = false
        break
      }
    }
    if (deletesEveryBookmark) {
      seen.add(groupKey)
      result.push(group)
    }
  }

  return result
}

function getDuplicateBookmarkIdGroups(managerModel) {
  const result = []
  const seen = new Set()
  const duplicateGroups = managerModel?.duplicateGroups || []

  for (let i = 0; i < duplicateGroups.length; i++) {
    appendDuplicateBookmarkIdGroup(
      result,
      seen,
      (duplicateGroups[i].bookmarks || []).map((bookmark) => bookmark.originalId),
    )
  }

  const idsByUrl = new Map()
  const bookmarks = managerModel?.bookmarks || []
  for (let i = 0; i < bookmarks.length; i++) {
    const url = normalizeDuplicateUrl(bookmarks[i])
    if (!url) {
      continue
    }
    let ids = idsByUrl.get(url)
    if (!ids) {
      ids = []
      idsByUrl.set(url, ids)
    }
    ids.push(bookmarks[i].originalId)
  }

  for (const ids of idsByUrl.values()) {
    appendDuplicateBookmarkIdGroup(result, seen, ids)
  }

  return result
}

function appendDuplicateBookmarkIdGroup(result, seen, ids) {
  const group = ids
    .map((id) => String(id || ''))
    .filter(Boolean)
    .sort()
  if (group.length < 2) {
    return
  }

  const key = group.join('\u0000')
  if (seen.has(key)) {
    return
  }

  seen.add(key)
  result.push(group)
}

function normalizeDuplicateUrl(bookmark) {
  return String(bookmark?.url || bookmark?.originalUrl || '')
    .trim()
    .toLowerCase()
}

function countCleanupChangeTypes(changes) {
  const counts = {
    addTags: 0,
    removeTags: 0,
    renameTags: 0,
    moveBookmarks: 0,
    rewriteTitles: 0,
    deleteBookmarks: 0,
  }

  for (let i = 0; i < changes.length; i++) {
    if (Object.hasOwn(counts, changes[i]?.type)) {
      counts[changes[i].type] += 1
    }
  }

  return counts
}

function limitPromptText(text) {
  const value = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
  return value.length > PROMPT_TEXT_LIMIT ? `${value.slice(0, PROMPT_TEXT_LIMIT - 3)}...` : value
}
