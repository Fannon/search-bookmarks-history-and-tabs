import { describe, expect, test } from '@jest/globals'

import {
  countBookmarkCleanupChanges,
  createBookmarkCleanupPrompt,
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
    expect(prompt).toContain('1 | OpenAI Docs')
    expect(prompt).toContain('dev | Development')
    expect(prompt).toContain('ai (1), llm (1)')
  })

  test('creates a lite prompt without embedding the full JSON schema', () => {
    const prompt = createBookmarkCleanupPrompt(managerModel, 'lite')

    expect(prompt).toContain('"rewriteTitles":[]')
    expect(prompt).not.toContain('"$schema"')
  })

  test('parses and normalizes a valid proposal', () => {
    const proposal = parseBookmarkCleanupProposal(
      JSON.stringify({
        bookmarkChangeProposal: '1.0',
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

    expect(proposal.changes.addTags[0].tags).toEqual(['Docs', 'AI'])
    expect(proposal.changes.rewriteTitles[0].title).toBe('OpenAI Docs Reference')
    expect(countBookmarkCleanupChanges(proposal)).toBe(5)
  })

  test('rejects references outside the current bookmark data', () => {
    const errors = validateBookmarkCleanupProposal(
      {
        bookmarkChangeProposal: '1.0',
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

  test('liberal parsing drops invalid entries with warnings', () => {
    const result = parseBookmarkCleanupProposalWithIssues(
      JSON.stringify({
        bookmarkChangeProposal: '1.0',
        changes: {
          addTags: [
            { id: 'add-1', bookmarkId: '1', tags: ['docs'], reason: 'Valid.' },
            { id: 'add-2', bookmarkId: 'missing', tags: ['lost'], reason: 'Missing bookmark.' },
          ],
          removeTags: [],
          renameTags: [{ id: 'rename-1', from: 'missing-tag', to: 'ai', reason: 'Missing tag.' }],
          moveBookmarks: [{ id: 'move-1', bookmarkId: '1', targetFolderId: 'missing', reason: 'Missing folder.' }],
          deleteBookmarks: [{ id: 'delete-1', bookmarkId: '2', duplicateOfBookmarkId: '2', reason: 'Same id.' }],
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
      'changes.renameTags[0] ignored because tag "missing-tag" does not exist.',
      'changes.moveBookmarks[0] ignored because targetFolderId "missing" does not exist.',
      'changes.deleteBookmarks[0] ignored because bookmarkId and duplicateOfBookmarkId are the same.',
      'changes.rewriteTitles[1] ignored because bookmarkId "missing" does not exist.',
    ])
  })
})
