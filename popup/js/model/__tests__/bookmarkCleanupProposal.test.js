import { describe, expect, test } from '@jest/globals'

import {
  countBookmarkCleanupChanges,
  createBookmarkCleanupApplyConfirmation,
  createBookmarkCleanupPrompt,
  createBookmarkCleanupPromptPayload,
  localAiBookmarkCleanupProposalSchema,
  parseBookmarkCleanupProposal,
  parseBookmarkCleanupProposalWithIssues,
  validateBookmarkCleanupProposal,
} from '../bookmarkCleanupProposal.js'

const managerModel = {
  bookmarks: [
    {
      originalId: '1',
      title: 'OpenAI Docs',
      originalUrl: 'https://platform.openai.com/docs',
      folderId: 'dev',
      folderArray: ['Development'],
      tagsArray: ['ai'],
    },
    {
      originalId: '2',
      title: 'Duplicate OpenAI Docs',
      originalUrl: 'https://platform.openai.com/docs',
      folderId: 'read',
      folderArray: ['Read Later'],
      tagsArray: ['llm'],
    },
    {
      originalId: '3',
      title: 'Different Docs',
      originalUrl: 'https://example.test/docs',
      folderId: 'read',
      folderArray: ['Read Later'],
      tagsArray: [],
    },
  ],
  duplicateGroups: [
    {
      url: 'https://platform.openai.com/docs',
      bookmarks: [
        { originalId: '1', originalUrl: 'https://platform.openai.com/docs' },
        { originalId: '2', originalUrl: 'https://platform.openai.com/docs' },
      ],
    },
  ],
  folderOptions: [
    { id: 'dev', label: 'Development', title: 'Development' },
    { id: 'read', label: 'Read Later', title: 'Read Later' },
  ],
  tagGroups: [
    { name: 'ai', count: 1 },
    { name: 'llm', count: 1 },
  ],
}

describe('bookmark cleanup proposal', () => {
  test('creates a prompt with schema and bookmark context', () => {
    const prompt = createBookmarkCleanupPrompt(managerModel)

    expect(prompt).toContain('Bookmark Cleanup Proposal')
    expect(prompt).toContain('Act as a careful browser bookmark curator')
    expect(prompt).toContain('1 | OpenAI Docs')
    expect(prompt).toContain('dev | Development')
    expect(prompt).toContain('ai (1), llm (1)')
    expect(prompt).toContain('safety ceiling, not a quota')
    expect(prompt).toContain('Do not force changes to fill the limit')
    expect(prompt).toContain('Bookmark context: included 3 of 3 bookmarks.')
    expect(prompt).toContain('Preserve distinctive project, repository, package, and product identifiers')
    expect(prompt).toContain('Do not remove tags merely because they are generic or redundant')
    expect(prompt).toContain('Output raw JSON only')
    expect(prompt).toContain('first character of your response must be "{"')
    expect(prompt).not.toContain('Omitted bookmark count')
  })

  test('creates a lite prompt without embedding the full JSON schema', () => {
    const prompt = createBookmarkCleanupPrompt(managerModel, 'lite')

    expect(prompt).toContain('"changes":{')
    expect(prompt).toContain('id | title | url | tags')
    expect(prompt).toContain('Do not propose bookmark moves or deletions.')
    expect(prompt).toContain('Change type focus: Everything')
    expect(prompt).toContain('Focus on addTags and rewriteTitles first')
    expect(prompt).toContain('Example output format only')
    expect(prompt).toContain('"addTags":[{"id":"add-1","bookmarkId":"bookmark-id-from-data"')
    expect(prompt).not.toContain('"moveBookmarks"')
    expect(prompt).not.toContain('"deleteBookmarks"')
    expect(prompt).not.toContain('Existing folders')
    expect(prompt).not.toContain('dev | Development')
    expect(prompt).not.toContain('"$schema"')
  })

  test('can generate an unlimited prompt', () => {
    const prompt = createBookmarkCleanupPrompt(managerModel, 'lite', { changeLimit: 'unlimited' })

    expect(prompt).not.toContain('No proposal count ceiling is set')
    expect(prompt).not.toContain('highest-confidence changes')
    expect(prompt).not.toContain('safety ceiling, not a quota')
  })

  test('limits bookmark context and reports omitted bookmark rows', () => {
    const prompt = createBookmarkCleanupPrompt(managerModel, 'lite', { bookmarkLimit: 2 })
    const payload = createBookmarkCleanupPromptPayload(managerModel, { bookmarkLimit: 2, includeFolders: false })

    expect(prompt).toContain('Bookmark context: included 2 of 3 bookmarks. Omitted 1')
    expect(prompt).toContain('1 | OpenAI Docs')
    expect(prompt).toContain('2 | Duplicate OpenAI Docs')
    expect(prompt).not.toContain('3 | Different Docs')
    expect(payload.includedBookmarkCount).toBe(2)
    expect(payload.omittedBookmarkCount).toBe(1)
    expect(payload.totalBookmarkCount).toBe(3)
    expect(payload.truncatedByCharacterBudget).toBe(false)
  })

  test('can focus a prompt on title changes', () => {
    const prompt = createBookmarkCleanupPrompt(managerModel, 'full', { changeFocus: 'title' })

    expect(prompt).toContain('Change type focus: Title')
    expect(prompt).toContain('Include only these change arrays when they have proposals: rewriteTitles')
    expect(prompt).toContain('"changes":{"rewriteTitles"')
    expect(prompt).toContain('"rewriteTitles":[{"id":"rewrite-1"')
    expect(prompt).toContain('Rewrite only when the current title harms')
    expect(prompt).toContain('Strip boilerplate prefixes')
    expect(prompt).not.toContain('Add useful, specific tags')
    expect(prompt).not.toContain('Use renameTags for tag merges')
    expect(prompt).not.toContain('Use only folder IDs')
    expect(prompt).not.toContain('Do not delete a bookmark')
  })

  test('omits folder context when advanced prompt only focuses tags', () => {
    const prompt = createBookmarkCleanupPrompt(managerModel, 'full', { changeFocus: 'tags' })

    expect(prompt).toContain('Change type focus: Tags')
    expect(prompt).toContain('id | title | url | tags')
    expect(prompt).toContain('Add useful, concise, lowercase tags')
    expect(prompt).toContain('For bookmarks with no tags, add only')
    expect(prompt).toContain('Use one renameTags entry per source tag')
    expect(prompt).toContain('Mutually exclusive: if you use renameTags')
    expect(prompt).not.toContain('Rewrite titles only when')
    expect(prompt).not.toContain('Do not rewrite titles for style alone')
    expect(prompt).not.toContain('Delete only exact or near-exact duplicate bookmarks')
    expect(prompt).not.toContain('Existing folders')
    expect(prompt).not.toContain('dev | Development')
  })

  test('keeps folder context when advanced prompt focuses folder structure', () => {
    const prompt = createBookmarkCleanupPrompt(managerModel, 'full', { changeFocus: 'folder' })

    expect(prompt).toContain('Change type focus: Folder Structure')
    expect(prompt).toContain('id | title | url | folderId | folderPath | tags')
    expect(prompt).toContain('Existing folders')
    expect(prompt).toContain('dev | Development')
    expect(prompt).toContain('Move a bookmark only when the target folder is clearly more specific')
    expect(prompt).toContain('Use only folder IDs')
    expect(prompt).not.toContain('Add useful, specific tags')
    expect(prompt).not.toContain('Rewrite titles only when')
    expect(prompt).not.toContain('Delete only exact or near-exact duplicate bookmarks')
  })

  test('supports folder-focused lite prompts with folder context', () => {
    const prompt = createBookmarkCleanupPrompt(managerModel, 'lite', { changeFocus: 'folder' })

    expect(prompt).toContain('Change type focus: Folder Structure')
    expect(prompt).toContain('Include only these change arrays when they have proposals: moveBookmarks')
    expect(prompt).toContain('id | title | url | folderId | folderPath | tags')
    expect(prompt).toContain('Existing folders')
    expect(prompt).toContain('dev | Development')
    expect(prompt).toContain('"changes":{"moveBookmarks"')
    expect(prompt).toContain('"moveBookmarks":[{"id":"move-1"')
    expect(prompt).toContain('Move a bookmark only when the target folder is clearly more specific')
    expect(prompt).toContain('Use only folder IDs')
    expect(prompt).toContain('Keep deleteBookmarks empty.')
    expect(prompt).not.toContain('Keep moveBookmarks empty.')
    expect(prompt).not.toContain('Lite mode has no folder data')
    expect(prompt).not.toContain('"$schema"')
  })

  test('can focus an advanced prompt on duplicate cleanup', () => {
    const prompt = createBookmarkCleanupPrompt(managerModel, 'full', { changeFocus: 'duplicates' })

    expect(prompt).toContain('Change type focus: Duplicates')
    expect(prompt).toContain('Include only these change arrays when they have proposals: deleteBookmarks')
    expect(prompt).toContain('"changes":{"deleteBookmarks"')
    expect(prompt).toContain('"deleteBookmarks":[{"id":"delete-1"')
    expect(prompt).toContain('Delete only exact or near-exact duplicate bookmarks')
    expect(prompt).toContain('Do not delete a bookmark unless duplicateOfBookmarkId')
    expect(prompt).not.toContain('Add useful, specific tags')
    expect(prompt).not.toContain('Rewrite titles only when')
    expect(prompt).not.toContain('Use only folder IDs')
  })

  test('uses a flat schema for local AI constrained generation', () => {
    const schema = JSON.stringify(localAiBookmarkCleanupProposalSchema)

    expect(schema).toContain('"rewriteTitles"')
    expect(schema).not.toContain('bookmarkChangeProposal')
    expect(schema).not.toContain('"required":["addTags"')
    expect(schema).not.toContain('"$ref"')
    expect(schema).not.toContain('"$defs"')
    expect(schema).not.toContain('"allOf"')
  })

  test('creates a bulk cleanup confirmation summary with destructive warnings', () => {
    const message = createBookmarkCleanupApplyConfirmation([
      { type: 'addTags', change: { id: 'add-1' } },
      { type: 'moveBookmarks', change: { id: 'move-1' } },
      { type: 'deleteBookmarks', change: { id: 'delete-1' } },
    ])

    expect(message).toContain('Apply 3 bookmark cleanup changes?')
    expect(message).toContain('Add tags: 1')
    expect(message).toContain('Move bookmarks: 1')
    expect(message).toContain('Delete bookmarks: 1')
    expect(message).toContain('destructive or structural bookmark changes')
    expect(message).toContain('Undo history is memory-only')
  })

  test('parses and normalizes a valid proposal', () => {
    const proposal = parseBookmarkCleanupProposal(
      JSON.stringify({
        summary: 'Clean up AI bookmarks.',
        changes: {
          addTags: [{ id: 'add-1', bookmarkId: '1', tags: ['Docs', '#AI'], reason: 'Useful docs.' }],
          removeTags: [],
          renameTags: [{ id: 'rename-1', from: 'llm', to: 'ai', reason: 'Near duplicate.' }],
          moveBookmarks: [{ id: 'move-1', bookmarkId: '2', targetFolderId: 'dev', reason: 'Developer reference.' }],
          deleteBookmarks: [{ id: 'delete-1', bookmarkId: '2', duplicateOfBookmarkId: '1', reason: 'Same URL.' }],
          rewriteTitles: [
            { id: 'rewrite-1', bookmarkId: '2', title: 'OpenAI Docs Reference #extra', reason: 'Shorter title.' },
          ],
        },
      }),
      managerModel,
    )

    expect(proposal.changes.addTags[0].tags).toEqual(['docs', 'ai'])
    expect(proposal.changes.rewriteTitles[0].title).toBe('OpenAI Docs Reference')
    expect(countBookmarkCleanupChanges(proposal)).toBe(5)
  })

  test('allows omitted change arrays and normalizes them to empty arrays', () => {
    const proposal = parseBookmarkCleanupProposal(
      JSON.stringify({
        changes: {
          rewriteTitles: [{ id: 'rewrite-1', bookmarkId: '1', title: 'OpenAI Docs Reference', reason: 'Clearer.' }],
        },
      }),
      managerModel,
    )

    expect(proposal.changes.addTags).toEqual([])
    expect(proposal.changes.rewriteTitles).toHaveLength(1)
  })

  test('rejects references outside the current bookmark data', () => {
    const errors = validateBookmarkCleanupProposal(
      {
        changes: {
          addTags: [{ id: 'add-1', bookmarkId: 'missing', tags: ['docs'], reason: 'No match.' }],
          removeTags: [],
          renameTags: [],
          moveBookmarks: [{ id: 'move-1', bookmarkId: '1', targetFolderId: 'missing', reason: 'No folder.' }],
          deleteBookmarks: [{ id: 'delete-1', bookmarkId: '1', duplicateOfBookmarkId: '1', reason: 'Invalid.' }],
          rewriteTitles: [{ id: 'rewrite-1', bookmarkId: 'missing', title: 'Missing', reason: 'No bookmark.' }],
        },
      },
      managerModel,
    )

    expect(errors).toEqual([
      'changes.addTags[0].bookmarkId does not match an existing bookmark.',
      'changes.moveBookmarks[0].targetFolderId does not match an existing folder.',
      'changes.deleteBookmarks[0] cannot delete and keep the same bookmark.',
      'changes.rewriteTitles[0].bookmarkId does not match an existing bookmark.',
    ])
  })

  test('rejects delete proposals for bookmarks that are not duplicates', () => {
    const errors = validateBookmarkCleanupProposal(
      {
        changes: {
          deleteBookmarks: [{ id: 'delete-1', bookmarkId: '3', duplicateOfBookmarkId: '1', reason: 'Wrong pair.' }],
        },
      },
      managerModel,
    )

    expect(errors).toEqual(['changes.deleteBookmarks[0] must reference bookmarks from the same duplicate URL group.'])
  })

  test('rejects delete proposals that remove every bookmark in a duplicate group', () => {
    const errors = validateBookmarkCleanupProposal(
      {
        changes: {
          deleteBookmarks: [
            { id: 'delete-1', bookmarkId: '1', duplicateOfBookmarkId: '2', reason: 'Same URL.' },
            { id: 'delete-2', bookmarkId: '2', duplicateOfBookmarkId: '1', reason: 'Same URL.' },
          ],
        },
      },
      managerModel,
    )

    expect(errors).toEqual(['changes.deleteBookmarks would delete every bookmark in duplicate group: 1, 2.'])
  })

  test('liberal parsing drops invalid entries with warnings', () => {
    const result = parseBookmarkCleanupProposalWithIssues(
      JSON.stringify({
        changes: {
          addTags: [
            { id: 'add-1', bookmarkId: '1', tags: ['docs'], reason: 'Valid.' },
            { id: 'add-2', bookmarkId: 'missing', tags: ['lost'], reason: 'Missing bookmark.' },
          ],
          removeTags: [],
          renameTags: [{ id: 'rename-1', from: 'missing-tag', to: 'ai', reason: 'Missing tag.' }],
          moveBookmarks: [{ id: 'move-1', bookmarkId: '1', targetFolderId: 'missing', reason: 'Missing folder.' }],
          deleteBookmarks: [
            { id: 'delete-1', bookmarkId: '2', duplicateOfBookmarkId: '2', reason: 'Same id.' },
            { id: 'delete-2', bookmarkId: '3', duplicateOfBookmarkId: '1', reason: 'Different URLs.' },
          ],
          rewriteTitles: [
            { id: 'rewrite-1', bookmarkId: '1', title: 'OpenAI Docs', reason: 'Short title.' },
            { id: 'rewrite-2', bookmarkId: 'missing', title: 'Missing', reason: 'Missing bookmark.' },
          ],
        },
      }),
      managerModel,
    )

    expect(result.errors).toEqual([])
    expect(result.proposal.changes.addTags).toEqual([
      { id: 'add-1', bookmarkId: '1', tags: ['docs'], reason: 'Valid.' },
    ])
    expect(result.proposal.changes.rewriteTitles).toEqual([
      { id: 'rewrite-1', bookmarkId: '1', title: 'OpenAI Docs', reason: 'Short title.' },
    ])
    expect(result.warnings).toEqual([
      'changes.addTags[1] ignored because bookmarkId "missing" does not exist.',
      'changes.renameTags[0] ignored because source tag "missing-tag" does not exist.',
      'changes.moveBookmarks[0] ignored because targetFolderId "missing" does not exist.',
      'changes.deleteBookmarks[0] ignored because bookmarkId and duplicateOfBookmarkId are the same.',
      'changes.deleteBookmarks[1] ignored because the bookmarks are not in the same duplicate URL group.',
      'changes.rewriteTitles[1] ignored because bookmarkId "missing" does not exist.',
    ])
  })

  test('liberal parsing drops delete proposals that remove every duplicate copy', () => {
    const result = parseBookmarkCleanupProposalWithIssues(
      JSON.stringify({
        changes: {
          deleteBookmarks: [
            { id: 'delete-1', bookmarkId: '1', duplicateOfBookmarkId: '2', reason: 'Same URL.' },
            { id: 'delete-2', bookmarkId: '2', duplicateOfBookmarkId: '1', reason: 'Same URL.' },
          ],
        },
      }),
      managerModel,
    )

    expect(result.errors).toEqual([])
    expect(result.proposal.changes.deleteBookmarks).toEqual([])
    expect(result.warnings).toEqual([
      'changes.deleteBookmarks ignored for duplicate group 1, 2 because it would delete every copy.',
    ])
  })
})
