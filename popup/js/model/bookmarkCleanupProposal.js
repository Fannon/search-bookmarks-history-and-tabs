/**
 * @file Prompt, schema, and validation helpers for AI bookmark cleanup proposals.
 */

const PROMPT_BOOKMARK_LIMIT = 2000
const PROMPT_TEXT_LIMIT = 180
const PROPOSAL_VERSION = '1.0'

export const bookmarkCleanupProposalSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://raw.githubusercontent.com/Fannon/search-bookmarks-history-and-tabs/main/popup/json/change-proposal.schema.json',
  title: 'Bookmark Cleanup Proposal',
  type: 'object',
  additionalProperties: false,
  required: ['bookmarkChangeProposal', 'changes'],
  properties: {
    bookmarkChangeProposal: {
      const: PROPOSAL_VERSION,
    },
    summary: {
      type: 'string',
    },
    changes: {
      type: 'object',
      additionalProperties: false,
      required: ['addTags', 'removeTags', 'renameTags', 'moveBookmarks', 'deleteBookmarks'],
      properties: {
        addTags: {
          type: 'array',
          items: { $ref: '#/$defs/tagChange' },
        },
        removeTags: {
          type: 'array',
          items: { $ref: '#/$defs/tagChange' },
        },
        renameTags: {
          type: 'array',
          items: { $ref: '#/$defs/renameTagChange' },
        },
        moveBookmarks: {
          type: 'array',
          items: { $ref: '#/$defs/moveBookmarkChange' },
        },
        deleteBookmarks: {
          type: 'array',
          items: { $ref: '#/$defs/deleteBookmarkChange' },
        },
      },
    },
  },
  $defs: {
    changeBase: {
      type: 'object',
      required: ['id', 'reason'],
      properties: {
        id: {
          type: 'string',
        },
        reason: {
          type: 'string',
        },
      },
    },
    tagChange: {
      allOf: [
        { $ref: '#/$defs/changeBase' },
        {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'bookmarkId', 'tags', 'reason'],
          properties: {
            id: { type: 'string' },
            bookmarkId: { type: 'string' },
            tags: {
              type: 'array',
              minItems: 1,
              maxItems: 8,
              items: { type: 'string' },
            },
            reason: { type: 'string' },
          },
        },
      ],
    },
    renameTagChange: {
      allOf: [
        { $ref: '#/$defs/changeBase' },
        {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'from', 'to', 'reason'],
          properties: {
            id: { type: 'string' },
            from: { type: 'string' },
            to: { type: 'string' },
            bookmarkIds: {
              type: 'array',
              items: { type: 'string' },
            },
            reason: { type: 'string' },
          },
        },
      ],
    },
    moveBookmarkChange: {
      allOf: [
        { $ref: '#/$defs/changeBase' },
        {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'bookmarkId', 'targetFolderId', 'reason'],
          properties: {
            id: { type: 'string' },
            bookmarkId: { type: 'string' },
            targetFolderId: { type: 'string' },
            targetFolderPath: { type: 'string' },
            reason: { type: 'string' },
          },
        },
      ],
    },
    deleteBookmarkChange: {
      allOf: [
        { $ref: '#/$defs/changeBase' },
        {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'bookmarkId', 'duplicateOfBookmarkId', 'reason'],
          properties: {
            id: { type: 'string' },
            bookmarkId: { type: 'string' },
            duplicateOfBookmarkId: { type: 'string' },
            reason: { type: 'string' },
          },
        },
      ],
    },
  },
}

/**
 * Build the prompt shown to users and sent to local AI.
 *
 * @param {Object} managerModel Bookmark manager model.
 * @returns {string} Prompt text.
 */
export function createBookmarkCleanupPrompt(managerModel) {
  const payload = createBookmarkCleanupPromptPayload(managerModel)

  return `
You are helping clean up a browser bookmark collection.

Use world knowledge plus the titles, URLs, folders, and current tags below to propose useful bookmark management changes.
Prefer conservative, reviewable changes over large speculative rewrites.

Goals:
- Add useful, specific tags where existing bookmark data strongly supports them.
- Remove misleading, redundant, or overly generic tags.
- Rename or merge near-duplicate tags across all matching bookmarks.
- Move bookmarks to a better existing folder when the target is clearly more appropriate.
- Delete only exact or near-exact duplicate bookmarks, keeping the better copy.

Rules:
- Use only bookmark IDs and folder IDs from the provided data.
- Do not invent folders. Use targetFolderId from existingFolders for moves.
- Prefer existing tag conventions, but add concise lowercase tags when they improve organization.
- Use renameTags for tag merges, for example "ai", "llm", and "genai" into one chosen tag.
- Do not delete a bookmark unless duplicateOfBookmarkId identifies the bookmark to keep.
- Return JSON only. No markdown, comments, or explanation outside JSON.
- The JSON must validate against this schema:
${JSON.stringify(bookmarkCleanupProposalSchema, null, 2)}

Bookmark data:
${JSON.stringify(payload, null, 2)}
  `.trim()
}

/**
 * Create compact bookmark manager data for prompt input.
 *
 * @param {Object} managerModel Bookmark manager model.
 * @returns {Object} Prompt payload.
 */
export function createBookmarkCleanupPromptPayload(managerModel) {
  const bookmarks = managerModel?.bookmarks || []
  const folderOptions = managerModel?.folderOptions || []
  const tagGroups = managerModel?.tagGroups || []

  return {
    bookmarkChangeProposal: PROPOSAL_VERSION,
    bookmarks: bookmarks.slice(0, PROMPT_BOOKMARK_LIMIT).map(formatBookmarkForPrompt),
    existingTags: tagGroups.map((tag) => ({
      tag: tag.name,
      count: tag.count,
    })),
    existingFolders: folderOptions.map((folder) => ({
      id: String(folder.id),
      path: folder.label || folder.title || String(folder.id),
    })),
    omittedBookmarkCount: Math.max(0, bookmarks.length - PROMPT_BOOKMARK_LIMIT),
  }
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
  if (proposal.bookmarkChangeProposal !== PROPOSAL_VERSION) {
    warnings.push(
      `Expected bookmarkChangeProposal "${PROPOSAL_VERSION}", got "${String(proposal.bookmarkChangeProposal || 'missing')}".`,
    )
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
  const bookmarkIds = new Set((managerModel?.bookmarks || []).map((bookmark) => String(bookmark.originalId)))
  const folderIds = new Set((managerModel?.folderOptions || []).map((folder) => String(folder.id)))
  const existingTags = new Set()
  const changes = proposal?.changes

  for (const group of managerModel?.tagGroups || []) {
    existingTags.add(group.name.toLowerCase())
  }

  if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal)) {
    return ['Cleanup proposal must be a JSON object.']
  }
  if (proposal.bookmarkChangeProposal !== PROPOSAL_VERSION) {
    errors.push(`bookmarkChangeProposal must be "${PROPOSAL_VERSION}".`)
  }
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
    errors.push('Cleanup proposal must include a changes object.')
    return errors
  }

  validateTagChanges(errors, changes.addTags, 'addTags', bookmarkIds)
  validateTagChanges(errors, changes.removeTags, 'removeTags', bookmarkIds)
  validateRenameTagChanges(errors, changes.renameTags, existingTags, bookmarkIds)
  validateMoveChanges(errors, changes.moveBookmarks, bookmarkIds, folderIds)
  validateDeleteChanges(errors, changes.deleteBookmarks, bookmarkIds)

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
    (changes.deleteBookmarks?.length || 0)
  )
}

function formatBookmarkForPrompt(bookmark) {
  return {
    id: String(bookmark.originalId),
    title: limitPromptText(bookmark.title || ''),
    url: limitPromptText(bookmark.originalUrl || bookmark.url || ''),
    folderId: String(bookmark.folderId || ''),
    folderPath: limitPromptText((bookmark.folderArray || []).join(' / ')),
    tags: bookmark.tagsArray || [],
  }
}

function validateTagChanges(errors, changes, name, bookmarkIds) {
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
  if (!Array.isArray(changes)) {
    errors.push('changes.renameTags must be an array.')
    return
  }

  for (let i = 0; i < changes.length; i++) {
    const change = changes[i]
    validateChangeBase(errors, change, 'renameTags', i)
    if (!existingTags.has(String(change?.from || '').toLowerCase())) {
      errors.push(`changes.renameTags[${i}].from does not match an existing tag.`)
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

function validateDeleteChanges(errors, changes, bookmarkIds) {
  if (!Array.isArray(changes)) {
    errors.push('changes.deleteBookmarks must be an array.')
    return
  }

  for (let i = 0; i < changes.length; i++) {
    const change = changes[i]
    validateChangeBase(errors, change, 'deleteBookmarks', i)
    if (!bookmarkIds.has(String(change?.bookmarkId))) {
      errors.push(`changes.deleteBookmarks[${i}].bookmarkId does not match an existing bookmark.`)
    }
    if (!bookmarkIds.has(String(change?.duplicateOfBookmarkId))) {
      errors.push(`changes.deleteBookmarks[${i}].duplicateOfBookmarkId does not match an existing bookmark.`)
    }
    if (String(change?.bookmarkId) === String(change?.duplicateOfBookmarkId)) {
      errors.push(`changes.deleteBookmarks[${i}] cannot delete and keep the same bookmark.`)
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
  if (!String(change.reason || '').trim()) {
    errors.push(`changes.${name}[${index}].reason is required.`)
  }
}

function normalizeBookmarkCleanupProposal(proposal) {
  return {
    bookmarkChangeProposal: PROPOSAL_VERSION,
    summary: String(proposal.summary || '').trim(),
    changes: {
      addTags: normalizeTagChanges(proposal.changes.addTags),
      removeTags: normalizeTagChanges(proposal.changes.removeTags),
      renameTags: proposal.changes.renameTags.map((change) => ({
        id: String(change.id).trim(),
        from: normalizePromptTag(change.from),
        to: normalizePromptTag(change.to),
        bookmarkIds: Array.isArray(change.bookmarkIds) ? change.bookmarkIds.map((id) => String(id)) : [],
        reason: String(change.reason).trim(),
      })),
      moveBookmarks: proposal.changes.moveBookmarks.map((change) => ({
        id: String(change.id).trim(),
        bookmarkId: String(change.bookmarkId),
        targetFolderId: String(change.targetFolderId),
        targetFolderPath: String(change.targetFolderPath || '').trim(),
        reason: String(change.reason).trim(),
      })),
      deleteBookmarks: proposal.changes.deleteBookmarks.map((change) => ({
        id: String(change.id).trim(),
        bookmarkId: String(change.bookmarkId),
        duplicateOfBookmarkId: String(change.duplicateOfBookmarkId),
        reason: String(change.reason).trim(),
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
    bookmarkChangeProposal: PROPOSAL_VERSION,
    summary: String(proposal.summary || '').trim(),
    changes: {
      addTags: normalizeTagChangesWithIssues(changes.addTags, 'addTags', bookmarkIds, warnings),
      removeTags: normalizeTagChangesWithIssues(changes.removeTags, 'removeTags', bookmarkIds, warnings),
      renameTags: normalizeRenameTagChangesWithIssues(changes.renameTags, existingTags, bookmarkIds, warnings),
      moveBookmarks: normalizeMoveChangesWithIssues(changes.moveBookmarks, bookmarkIds, folderIds, warnings),
      deleteBookmarks: normalizeDeleteChangesWithIssues(changes.deleteBookmarks, bookmarkIds, warnings),
    },
  }
}

function normalizeTagChangesWithIssues(changes, name, bookmarkIds, warnings) {
  if (!Array.isArray(changes)) {
    warnings.push(`changes.${name} was missing or not an array; treated as empty.`)
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
      reason: String(change.reason || 'No reason provided.').trim(),
    })
  }

  return result
}

function normalizeRenameTagChangesWithIssues(changes, existingTags, bookmarkIds, warnings) {
  if (!Array.isArray(changes)) {
    warnings.push('changes.renameTags was missing or not an array; treated as empty.')
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
      warnings.push(`${context} ignored because tag "${from || 'missing'}" does not exist.`)
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
      reason: String(change.reason || 'No reason provided.').trim(),
    })
  }

  return result
}

function normalizeMoveChangesWithIssues(changes, bookmarkIds, folderIds, warnings) {
  if (!Array.isArray(changes)) {
    warnings.push('changes.moveBookmarks was missing or not an array; treated as empty.')
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
      reason: String(change.reason || 'No reason provided.').trim(),
    })
  }

  return result
}

function normalizeDeleteChangesWithIssues(changes, bookmarkIds, warnings) {
  if (!Array.isArray(changes)) {
    warnings.push('changes.deleteBookmarks was missing or not an array; treated as empty.')
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

    result.push({
      id: normalizeChangeId(change.id, 'deleteBookmarks', i),
      bookmarkId,
      duplicateOfBookmarkId,
      reason: String(change.reason || 'No reason provided.').trim(),
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
    reason: String(change.reason).trim(),
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
  return String(tag || '')
    .replaceAll('#', '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

function limitPromptText(text) {
  const value = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
  return value.length > PROMPT_TEXT_LIMIT ? `${value.slice(0, PROMPT_TEXT_LIMIT - 3)}...` : value
}
