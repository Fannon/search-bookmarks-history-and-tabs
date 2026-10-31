/**
 * @file Prompt, schema, and validation helpers for AI bookmark cleanup proposals.
 */

import { getDuplicateUrlKey } from './bookmarkManagerData.js'
import { normalizeTagName } from './bookmarkManagerOperations.js'

const DEFAULT_PROMPT_BOOKMARK_LIMIT = 1000
const PROMPT_BOOKMARK_TEXT_BUDGET = 80000
const PROMPT_TEXT_LIMIT = 180
// Local models have about 8k tokens of context. ~20k characters is roughly 6k input tokens,
// leaving about 2k tokens for output.
const LITE_PROMPT_CHAR_BUDGET = 20000
const LITE_PROMPT_TEXT_LIMIT = 100
const LITE_CHANGE_LIMIT = 25
const PROMPT_FULL = 'full'
const PROMPT_LITE = 'lite'
const PROMPT_HTTPS_PREFIX_REGEX = /^https:\/\/(?:www\.)?/i
const PROMPT_URL_PREFIX_REGEX = /^https?:\/\/(?:www\.)?/i
const PROMPT_URL_SUFFIX_REGEX = /[?#].*$/
const TRAILING_SLASH_REGEX = /\/$/
const LITE_PROMPT_RULES = {
  addTags:
    '- addTags: Add 1–3 concise lowercase tags to untagged bookmarks, or 1–2 to tagged ones, when the title, URL, or domain clearly supports them. Strongly prefer existing tags, in their language. Do not add a tag just because a word appears in the title.',
  removeTags: '- removeTags: Remove a tag only when it is clearly wrong for the bookmark.',
  renameTags:
    '- renameTags: Merge a tag into a clearly better existing tag, one entry per source tag. Do not also add or remove the same tag.',
  moveBookmarks:
    '- moveBookmarks: Move a bookmark only when an existing folder is clearly more accurate. Use only folder IDs from the folder list.',
  rewriteTitles:
    '- rewriteTitles: Rewrite only long, noisy, boilerplate, or URL-only titles into a short title derived from the existing title and URL. Keep project, repository, and product names.',
}
const PROMPT_OUTPUT_REMINDER = `
## Reminder
Apply the rules above to the data. Return only the raw JSON object described in Output Requirements: no code fences or other text, only IDs from the provided data, and no empty change arrays.`
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

/**
 * Build the local AI response constraint for a prompt mode and focus.
 *
 * Only allowed change types are included. Lite omits `reason` to save output tokens.
 *
 * @param {'lite'|'full'} [mode='full'] Prompt detail mode.
 * @param {Object} [options] Prompt options.
 * @param {'everything'|'tags'|'title'|'folder'|'duplicates'} [options.changeFocus='everything'] Change type focus.
 * @returns {Object} JSON schema.
 */
export function createLocalAiBookmarkCleanupProposalSchema(mode = PROMPT_FULL, options = {}) {
  const isLite = mode === PROMPT_LITE
  const allowedChangeTypes = getAllowedPromptChangeTypes(isLite, normalizePromptChangeFocus(options.changeFocus))
  const changeProperties = createChangeProperties()
  const properties = {}

  for (let i = 0; i < allowedChangeTypes.length; i++) {
    const property = changeProperties[allowedChangeTypes[i]]
    if (isLite) {
      const { reason: _reason, ...itemProperties } = property.items.properties
      property.items = { ...property.items, properties: itemProperties }
    }
    properties[allowedChangeTypes[i]] = property
  }

  return {
    ...OBJECT_SCHEMA_BASE,
    required: ['summary', 'changes'],
    properties: {
      summary: STRING_SCHEMA,
      changes: {
        ...OBJECT_SCHEMA_BASE,
        properties,
      },
    },
  }
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
  if (mode === PROMPT_LITE) {
    return createLiteBookmarkCleanupPromptBatches(managerModel, { ...options, maxBatches: 1 })[0].prompt.trim()
  }

  const changeLimit = normalizePromptChangeLimit(options.changeLimit)
  const changeFocus = normalizePromptChangeFocus(options.changeFocus)
  const allowedChangeTypes = getAllowedPromptChangeTypes(false, changeFocus)
  const needsFolders = allowedChangeTypes.includes('moveBookmarks')
  const needsDuplicates = allowedChangeTypes.includes('deleteBookmarks')
  const payload = createBookmarkCleanupPromptPayload(managerModel, {
    bookmarkLimit: options.bookmarkLimit,
    includeFolders: needsFolders,
  })
  const decisionPolicy = [
    formatPromptChangeLimit(changeLimit),
    '- Use stricter confidence for higher-risk changes: deleteBookmarks requires very high confidence, moveBookmarks and renameTags require high confidence.',
    '- For addTags and rewriteTitles, medium confidence is acceptable when the title, URL, domain, folder, current tags, or existing tag patterns provide clear reviewable evidence.',
    '- Prefer no change over a weak or speculative change, especially for destructive or structural changes.',
    '- Do not optimize for the number of changes. When many bookmarks are untagged, sparsely tagged, or have noisy titles, return a focused batch of the best reviewable addTags and rewriteTitles suggestions.',
    formatPromptFocusInstruction(changeFocus, allowedChangeTypes),
    `- Bookmark context: included ${payload.includedBookmarkCount} of ${payload.totalBookmarkCount} bookmark${payload.totalBookmarkCount === 1 ? '' : 's'}.${payload.omittedBookmarkCount ? ` Omitted ${payload.omittedBookmarkCount} due to the selected bookmark/context limit.` : ''}${payload.truncatedByCharacterBudget ? ` Stopped at the ${PROMPT_BOOKMARK_TEXT_BUDGET} character bookmark-context budget.` : ''}`,
  ]
  const selfChecks = [
    'Valid JSON: no trailing commas, all property names double-quoted, braces balanced.',
    'Every change object has all required fields (id, bookmarkId, and tags/title/from/to/targetFolderId/duplicateOfBookmarkId as applicable).',
    'Every bookmarkId exists in the provided bookmark data.',
  ]
  if (needsFolders) {
    selfChecks.push('Every targetFolderId exists in the existing folder list.')
  }
  if (needsDuplicates) {
    selfChecks.push('Every deleted bookmark and its duplicateOfBookmarkId belong to the same listed duplicate group.')
  }
  selfChecks.push('The first character is "{" and the last character is "}".')
  const inputSections = [`Existing tags (with usage counts):\n${payload.existingTags}`]
  if (needsFolders) {
    inputSections.push(`Existing folders:\n${payload.existingFolders}`)
  }
  if (needsDuplicates) {
    inputSections.push(formatDuplicateGroupsForPrompt(managerModel?.duplicateGroups))
  }
  inputSections.push(
    `Bookmarks, one per line as ${needsFolders ? 'id | title | url | folderId | folderPath | tags' : 'id | title | url | tags'} (URLs without https:// and www.):\n${payload.bookmarks}`,
  )

  return `
## Role
Act as a careful browser bookmark curator focused on practical tag cleanup, duplicate detection, concise titles, and conservative folder organization.

## Task
Propose practical, reviewable bookmark cleanup changes using the bookmark data provided at the end of this prompt.

## Evidence Policy
- Primary evidence: each bookmark's title, URL, folder path, and current tags.
- Secondary evidence: the list of existing tags with usage counts shows the user's naming conventions.
- World knowledge: use common web and domain knowledge only to confirm patterns already visible in the bookmark data. Do not infer niche details, repository contents, package purposes, or product categories not evident from the title, URL, folder, or tags.

## Decision Policy
${decisionPolicy.filter(Boolean).join('\n')}

## Rules by Change Type
- Use only bookmark IDs from the provided data.
- If unsure about a required field, omit that change instead of using placeholders.
- Include reason when it adds useful review context. For medium-confidence addTags, the reason should name the evidence: title, URL path, domain, folder, current tags, or existing tag pattern.
- Keep summary to one short sentence.
${formatPromptGoals(allowedChangeTypes)}

## Output Requirements
- Output raw JSON only. Do not include introductory text, conversational filler, comments, or markdown formatting. Do not wrap the output in code fences such as \`\`\`json.
- The first character of your response must be "{" and the last character must be "}".
- Output base shape: {"summary":"","changes":{}}
- Omit every change type key that has no proposals. Do not output empty arrays.
Example output format only. Do not copy example IDs; use IDs from the provided data:
${createPromptExample(allowedChangeTypes)}

## Internal Self-Check
Before finalizing, verify:
${selfChecks.map((check, index) => `${index + 1}. ${check}`).join('\n')}

## Input Data

${inputSections.join('\n\n')}
${PROMPT_OUTPUT_REMINDER}
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
  const folderLabels = new Map(folderOptions.map((folder) => [String(folder.id), folder.label || folder.title]))
  const bookmarkPayload = createBookmarkPromptRows(bookmarks, includeFolders, bookmarkLimit, folderLabels)

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

function createBookmarkPromptRows(bookmarks, includeFolders, bookmarkLimit, folderLabels) {
  const maxBookmarks = bookmarkLimit ? Math.min(bookmarkLimit, bookmarks.length) : bookmarks.length
  const rowFolderLabels = includeFolders ? folderLabels : null
  const result = collectPromptRows(bookmarks, 0, maxBookmarks, PROMPT_BOOKMARK_TEXT_BUDGET, (bookmark) =>
    formatBookmarkForPrompt(bookmark, rowFolderLabels, false),
  )

  return {
    bookmarks: result.rows.join('\n'),
    includedBookmarkCount: result.rows.length,
    omittedBookmarkCount: bookmarks.length - result.rows.length,
    truncatedByCharacterBudget: result.nextIndex < maxBookmarks,
  }
}

function collectPromptRows(bookmarks, start, end, textBudget, formatRow) {
  const rows = []
  let textLength = 0
  let i = start

  for (; i < end; i++) {
    const row = formatRow(bookmarks[i])
    const nextLength = textLength + row.length + (rows.length ? 1 : 0)
    // Always include one row so a batch can make progress.
    if (nextLength > textBudget && rows.length) {
      break
    }
    rows.push(row)
    textLength = nextLength
  }

  return { rows, nextIndex: i }
}

/**
 * Build compact lite prompts that cover the bookmark context in budget-sized batches.
 *
 * @param {Object} managerModel Bookmark manager model.
 * @param {Object} [options] Prompt options, as for createBookmarkCleanupPrompt.
 * @param {number} [options.charBudget] Maximum characters per prompt.
 * @param {number} [options.maxBatches] Stop after this many batches.
 * @returns {Array<{prompt: string, bookmarkCount: number}>} Prompt batches.
 */
export function createLiteBookmarkCleanupPromptBatches(managerModel, options = {}) {
  const changeFocus = normalizePromptChangeFocus(options.changeFocus)
  const allowedChangeTypes = getAllowedPromptChangeTypes(true, changeFocus)
  const includeFolders = allowedChangeTypes.includes('moveBookmarks')
  const bookmarks = getLitePromptBookmarks(
    managerModel?.bookmarks || [],
    allowedChangeTypes.includes('addTags'),
    normalizePromptBookmarkLimit(options.bookmarkLimit),
  )
  const folderOptions = managerModel?.folderOptions || []
  const folderLabels = includeFolders
    ? new Map(folderOptions.map((folder) => [String(folder.id), folder.label || folder.title]))
    : null
  const header = createLitePromptHeader(managerModel, options, changeFocus, allowedChangeTypes, includeFolders)
  const rowBudget = (options.charBudget || LITE_PROMPT_CHAR_BUDGET) - header.length
  const maxBatches = options.maxBatches || Number.POSITIVE_INFINITY
  const formatRow = (bookmark) => formatBookmarkForPrompt(bookmark, folderLabels, true)
  const batches = []

  for (let start = 0; batches.length < maxBatches && (start < bookmarks.length || !batches.length); ) {
    const { rows, nextIndex } = collectPromptRows(bookmarks, start, bookmarks.length, rowBudget, formatRow)
    batches.push({ prompt: `${header}${rows.join('\n')}`, bookmarkCount: rows.length })
    start = nextIndex
  }

  return batches
}

function getLitePromptBookmarks(bookmarks, prioritizeUntagged, bookmarkLimit) {
  let result = bookmarks
  if (prioritizeUntagged) {
    const untagged = []
    const tagged = []
    for (let i = 0; i < bookmarks.length; i++) {
      if (bookmarks[i].tagsArray?.length) {
        tagged.push(bookmarks[i])
      } else {
        untagged.push(bookmarks[i])
      }
    }
    result = untagged.concat(tagged)
  }
  return bookmarkLimit ? result.slice(0, bookmarkLimit) : result
}

function createLitePromptHeader(managerModel, options, changeFocus, allowedChangeTypes, includeFolders) {
  const changeLimit = Math.min(normalizePromptChangeLimit(options.changeLimit) || LITE_CHANGE_LIMIT, LITE_CHANGE_LIMIT)
  const tags = (managerModel?.tagGroups || []).map((tag) => `${tag.name} (${tag.count})`).join(', ')
  const folders = includeFolders
    ? `\n\nFolders, one per line as id | path:\n${(managerModel?.folderOptions || [])
        .map((folder) => `${folder.id} | ${folder.label || folder.title || folder.id}`)
        .join('\n')}`
    : ''
  const rules = allowedChangeTypes.length
    ? allowedChangeTypes.map((type) => LITE_PROMPT_RULES[type])
    : [
        changeFocus === 'duplicates'
          ? '- Lite mode does not handle duplicates. Use Advanced for duplicate cleanup.'
          : '- No change types are available in this mode.',
        '- Return an empty changes object.',
      ]

  return `## Task
You are a careful bookmark curator. Propose practical, reviewable cleanup changes for the bookmarks below.

## Rules
- Evidence: only each bookmark's title, URL, and tags, plus the existing tags. Do not guess page contents.
- Prefer no change over a weak or speculative one. Propose at most ${changeLimit} changes; fewer is fine.
- Use only bookmark IDs from the data. Keep summary to one short sentence.
${rules.join('\n')}
- Return raw JSON only and omit change arrays without proposals. Example format (use real IDs):
${createPromptExample(allowedChangeTypes)}

## Data
Existing tags (with usage counts): ${tags}${folders}

Bookmarks, one per line as ${includeFolders ? 'id | title | url | folderId | folderPath | tags' : 'id | title | url | tags'} (URLs without https:// and www.):
`
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

  return `- Use ${changeLimit} as a safety ceiling, not a quota. Do not force changes to fill the limit; if there are only 10 good improvements, return only 10. For addTags and rewriteTitles, prefer a useful review batch of the strongest suggestions up to the limit.`
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
    ? ['addTags']
    : ['addTags', 'removeTags', 'renameTags', 'moveBookmarks', 'deleteBookmarks', 'rewriteTitles']
}

function formatPromptGoals(allowedChangeTypes) {
  const goals = []

  if (allowedChangeTypes.includes('addTags')) {
    goals.push(
      '- addTags: Add useful, concise, lowercase tags when supported by title, URL structure, domain, folder, current tags, or existing collection tag patterns. Strongly prefer tags that already exist in the collection unless the bookmark clearly needs a broadly reusable new tag. For already-tagged bookmarks, suggest at most 1–2 new tags. For bookmarks with no tags, suggest at most 1–3 fundamental tags (e.g. "github", "docs", "reference") when the evidence is clear enough for quick human review. Do not add a tag simply because a word appears in the title. Match the language of existing tags; do not add a translation of a tag that already exists (e.g. "weather" when "wetter" exists).',
    )
  }
  if (allowedChangeTypes.includes('removeTags')) {
    goals.push(
      '- removeTags: Remove a tag only when it is misleading, incorrect, or a clearly poor fit for the bookmark. Do not remove tags merely because they are generic or redundant; tags may intentionally improve search scoring as keywords.',
    )
  }
  if (allowedChangeTypes.includes('renameTags')) {
    goals.push(
      '- renameTags: Use one renameTags entry per source tag being renamed or merged. Example: to merge "genai" and "llm" into "ai", create two separate entries — one from "genai" to "ai", one from "llm" to "ai". Only rename when the replacement is clearly better aligned with the collection\'s naming convention. Tags that are translations of each other (e.g. "wetter" and "weather") may be merged into the more used one. Mutually exclusive: if you use renameTags, do not also add/remove the same tag in addTags/removeTags.',
    )
  }
  if (allowedChangeTypes.includes('moveBookmarks')) {
    goals.push(
      '- moveBookmarks: Move a bookmark only when the target folder is clearly more specific or clearly more accurate than the current folder. Do not propose a move when the current folder is already reasonable. Use only folder IDs from the provided existing folder list. Do not invent folders.',
    )
  }
  if (allowedChangeTypes.includes('deleteBookmarks')) {
    goals.push(
      '- deleteBookmarks: Delete only bookmarks from the listed duplicate groups; no other bookmarks are duplicates. Set duplicateOfBookmarkId to the bookmark to keep from the same group, normally suggestedKeepId. Keep a different copy only when its title, folder, or tags are clearly better. Keep at least one bookmark per group. When in doubt, do not propose deletion.',
    )
  }
  if (allowedChangeTypes.includes('rewriteTitles')) {
    goals.push(
      '- rewriteTitles: Be conservative. Do not rewrite short, clear, or already useful titles. Rewrite when the current title is very long, noisy, duplicated boilerplate, truncated, only a URL, hostname, or path, or looks like an unedited webpage title that harms search or review quality. A medium-confidence improvement is acceptable only when the cleaner title can be derived from the existing title and URL. Do not rewrite for style alone. Strip boilerplate prefixes (e.g. "GitHub - owner/repo: description" → "owner/repo — description", "npm: package-name" → "package-name", "Home | Vendor Product" → "Vendor Product"). Preserve distinctive project, repository, package, and product identifiers. Do not add inferred categories, folder names, scores, domains, or subjective adjectives to rewritten titles.',
    )
  }
  if (!goals.length) {
    goals.push('- No change types are available in this mode. Return an empty changes object.')
  }

  return goals.join('\n')
}

function formatPromptFocusInstruction(changeFocus, allowedChangeTypes) {
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
  return `- Change type focus: ${label}. Include only these change arrays when they have proposals: ${allowedChangeTypes.join(', ')}. Omit other change arrays.`
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

  return JSON.stringify({ summary: 'Short summary.', changes })
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
 * Merge raw proposals from batched local AI runs into one proposal.
 *
 * Change IDs get a batch prefix so they stay unique, and repeated tag renames are dropped.
 *
 * @param {Array<Object>} proposals Parsed batch proposals.
 * @returns {{summary: string, changes: Object}} Merged raw proposal.
 */
export function mergeBookmarkCleanupProposals(proposals = []) {
  const summaries = []
  const changes = {}
  const renameKeys = new Set()

  for (let i = 0; i < proposals.length; i++) {
    const proposal = proposals[i]
    if (proposal?.summary) {
      summaries.push(String(proposal.summary))
    }
    for (const [type, items] of Object.entries(proposal?.changes || {})) {
      if (!Array.isArray(items)) {
        continue
      }
      changes[type] ||= []
      for (let j = 0; j < items.length; j++) {
        const item = items[j]
        if (!item || typeof item !== 'object') {
          continue
        }
        if (type === 'renameTags') {
          const key = `${item.from}\u0000${item.to}`
          if (renameKeys.has(key)) {
            continue
          }
          renameKeys.add(key)
        }
        changes[type].push(proposals.length > 1 ? { ...item, id: `b${i + 1}-${item.id || j + 1}` } : item)
      }
    }
  }

  return { summary: summaries.join(' '), changes }
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

/**
 * Format one bookmark prompt row. Folder columns are included when folderLabels is set.
 * Compact rows use shorter text and leave out an empty trailing tags column.
 */
function formatBookmarkForPrompt(bookmark, folderLabels, compact) {
  const textLimit = compact ? LITE_PROMPT_TEXT_LIMIT : PROMPT_TEXT_LIMIT
  const columns = [
    String(bookmark.originalId),
    limitPromptText(bookmark.title || '', textLimit),
    limitPromptText(formatPromptUrl(bookmark.originalUrl || bookmark.url || '', compact), textLimit),
  ]
  if (folderLabels) {
    const folderId = String(bookmark.folderId || '')
    columns.push(folderId, limitPromptText(folderLabels.get(folderId) || (bookmark.folderArray || []).join(' / ')))
  }
  const tags = (bookmark.tagsArray || []).join(', ')
  if (tags || !compact) {
    columns.push(tags)
  }
  return columns.join(' | ')
}

/**
 * Shorten a URL for prompts. Compact mode also drops http://, query strings,
 * fragments, and a trailing slash, which rarely help tagging or titles.
 */
function formatPromptUrl(url, compact) {
  if (!compact) {
    return url.replace(PROMPT_HTTPS_PREFIX_REGEX, '')
  }
  return url.replace(PROMPT_URL_PREFIX_REGEX, '').replace(PROMPT_URL_SUFFIX_REGEX, '').replace(TRAILING_SLASH_REGEX, '')
}

function formatDuplicateGroupsForPrompt(duplicateGroups = []) {
  const rows = []
  for (let i = 0; i < duplicateGroups.length; i++) {
    const ids = (duplicateGroups[i].bookmarks || []).map((bookmark) => String(bookmark.originalId))
    if (ids.length > 1) {
      rows.push(
        `${ids[0]} | ${ids.slice(1).join(', ')} | ${limitPromptText(formatPromptUrl(duplicateGroups[i].url || '', false))}`,
      )
    }
  }

  return rows.length
    ? `Duplicate groups (same page by URL), one per line as: suggestedKeepId | otherIds | url\n${rows.join('\n')}`
    : 'Duplicate groups: none.'
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
    if (change?.bookmarkIds !== undefined && !Array.isArray(change.bookmarkIds)) {
      errors.push(`changes.renameTags[${i}].bookmarkIds must be an array.`)
    } else if (Array.isArray(change?.bookmarkIds)) {
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

    const targetIds = normalizeOptionalBookmarkIds(change.bookmarkIds, bookmarkIds, context, warnings)
    if (targetIds === null) {
      warnings.push(`${context} ignored because it has no valid target bookmarks.`)
      continue
    }
    result.push({
      id: normalizeChangeId(change.id, 'renameTags', i),
      from,
      to,
      bookmarkIds: targetIds,
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
  if (bookmarkIds === undefined) return []
  if (!Array.isArray(bookmarkIds)) {
    warnings.push(`${context}.bookmarkIds must be an array.`)
    return null
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
  return bookmarkIds.length && !result.length ? null : result
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
    urlsByBookmarkId.set(String(bookmarks[i].originalId), getDuplicateUrlKey(bookmarks[i]))
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
    const url = getDuplicateUrlKey(bookmarks[i])
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

function limitPromptText(text, limit = PROMPT_TEXT_LIMIT) {
  const value = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
  return value.length > limit ? `${value.slice(0, limit - 3)}...` : value
}
