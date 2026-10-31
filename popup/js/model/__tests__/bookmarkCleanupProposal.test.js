import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { cleanUpUrl } from '../../helper/utils.js'
import {
  countBookmarkCleanupChanges,
  createBookmarkCleanupApplyConfirmation,
  createBookmarkCleanupPrompt,
  createBookmarkCleanupPromptPayload,
  createLiteBookmarkCleanupPromptBatches,
  createLocalAiBookmarkCleanupProposalSchema,
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
  test('invalid rename targets never become an unrestricted rename', () => {
    for (const bookmarkIds of [['missing'], 'missing']) {
      const result = parseBookmarkCleanupProposalWithIssues(
        JSON.stringify({
          changes: { renameTags: [{ id: 'rename', from: 'ai', to: 'new', bookmarkIds }] },
        }),
        managerModel,
      )
      assert.deepStrictEqual(result.proposal.changes.renameTags, [])
      assert(result.warnings.some((warning) => warning.includes('no valid target bookmarks')))
    }
    const mixed = parseBookmarkCleanupProposalWithIssues(
      JSON.stringify({
        changes: { renameTags: [{ id: 'rename', from: 'ai', to: 'new', bookmarkIds: ['1', 'missing'] }] },
      }),
      managerModel,
    )
    assert.deepStrictEqual(mixed.proposal.changes.renameTags[0].bookmarkIds, ['1'])
    const global = parseBookmarkCleanupProposalWithIssues(
      JSON.stringify({
        changes: { renameTags: [{ id: 'rename', from: 'ai', to: 'new' }] },
      }),
      managerModel,
    )
    assert.deepStrictEqual(global.proposal.changes.renameTags[0].bookmarkIds, [])
  })
  test('creates a prompt with output rules and bookmark context', () => {
    const prompt = createBookmarkCleanupPrompt(managerModel)
    assert(prompt.includes('Act as a careful browser bookmark curator'))
    assert(prompt.includes('1 | OpenAI Docs'))
    assert(prompt.includes('dev | Development'))
    assert(prompt.includes('ai (1), llm (1)'))
    assert(prompt.includes('safety ceiling, not a quota'))
    assert(prompt.includes('Do not force changes to fill the limit'))
    assert(prompt.includes('Bookmark context: included 3 of 3 bookmarks.'))
    assert(prompt.includes('Preserve distinctive project, repository, package, and product identifiers'))
    assert(prompt.includes('Do not remove tags merely because they are generic or redundant'))
    assert(prompt.includes('return a focused batch of the best reviewable'))
    assert(prompt.includes('do not add existing tags that contain spaces'))
    const unlimitedPrompt = createBookmarkCleanupPrompt(managerModel, 'full', { changeLimit: 'unlimited' })
    assert(unlimitedPrompt.includes('No change limit is set: cover every bookmark where the evidence is clear'))
    assert(!unlimitedPrompt.includes('focused batch'))
    assert(prompt.includes('the reason should name the evidence'))
    assert(prompt.includes('Output raw JSON only'))
    assert(prompt.includes('first character of your response must be "{"'))
    assert(!prompt.includes('"$schema"'))
    assert(!prompt.includes('Omitted bookmark count'))
  })
  test('creates a lite tag-suggestion prompt for untagged bookmarks', () => {
    const prompt = createBookmarkCleanupPrompt(managerModel, 'lite')
    assert(prompt.startsWith('Suggest tags for each bookmark below.'))
    assert(prompt.includes("Usage counts show the user's conventions: ai (1), llm (1)"))
    assert(prompt.includes('Output JSON only: {"suggestions":[{"bookmarkId":"id from the list","tags":["tag"]}]}'))
    assert(
      prompt.endsWith(
        'id | title | url | folder (URLs without https:// and www.):\n3 | Different Docs | example.test/docs | Read Later',
      ),
    )
    assert(!prompt.includes('OpenAI Docs'))
    assert(!prompt.includes('summary'))
    assert(!prompt.includes('removeTags'))
  })
  test('compacts lite URLs and limits batches to 20 bookmarks', () => {
    const bookmarks = Array.from({ length: 45 }, (_, i) => ({
      originalId: String(i + 1),
      title: `Bookmark ${i + 1}`,
      originalUrl: `http://www.example.test/${i + 1}/?q=1#top`,
      folderArray: ['Dev', 'Tools'],
      tagsArray: [],
    }))
    const batches = createLiteBookmarkCleanupPromptBatches({ ...managerModel, bookmarks })
    assert.deepStrictEqual(
      batches.map((batch) => batch.bookmarkCount),
      [20, 20, 5],
    )
    assert(batches[0].prompt.includes('\n1 | Bookmark 1 | example.test/1 | Dev / Tools'))
    assert(batches[1].prompt.includes('\n21 | Bookmark 21 |'))

    const header = createLiteBookmarkCleanupPromptBatches({ ...managerModel, bookmarks: bookmarks.slice(0, 1) })[0]
      .prompt
    const charBudget = header.length + 200
    const smallBatches = createLiteBookmarkCleanupPromptBatches({ ...managerModel, bookmarks }, { charBudget })
    assert(smallBatches.length > 3)
    assert(smallBatches.every((batch) => batch.prompt.length <= charBudget))
    assert.strictEqual(
      smallBatches.reduce((sum, batch) => sum + batch.bookmarkCount, 0),
      45,
    )
  })
  test('lite only suggests tags and skips scopes without untagged bookmarks', () => {
    for (const changeFocus of ['title', 'folder', 'duplicates']) {
      assert.deepStrictEqual(createLiteBookmarkCleanupPromptBatches(managerModel, { changeFocus }), [])
      assert.strictEqual(createBookmarkCleanupPrompt(managerModel, 'lite', { changeFocus }), '')
    }
    assert.strictEqual(createLiteBookmarkCleanupPromptBatches(managerModel, { changeFocus: 'tags' }).length, 1)
    const tagged = managerModel.bookmarks.map((bookmark) => ({ ...bookmark, tagsArray: ['ai'] }))
    assert.deepStrictEqual(createLiteBookmarkCleanupPromptBatches({ ...managerModel, bookmarks: tagged }), [])
  })
  test('turns lite tag suggestions into filtered addTags changes', () => {
    const result = parseBookmarkCleanupProposalWithIssues(
      JSON.stringify({
        suggestions: [
          { bookmarkId: '1', tags: ['ai', 'docs', '#Docs'] },
          { bookmarkId: '3', tags: ['docs', 'llm', 'x', 'y'] },
          { bookmarkId: '2', tags: ['solo'] },
          { bookmarkId: 'missing', tags: ['ai'] },
        ],
      }),
      managerModel,
    )
    assert.deepStrictEqual(result.errors, [])
    assert.deepStrictEqual(
      result.proposal.changes.addTags.map(({ id, bookmarkId, tags }) => ({ id, bookmarkId, tags })),
      [
        { id: 'add-1', bookmarkId: '1', tags: ['docs'] },
        { id: 'add-2', bookmarkId: '3', tags: ['docs', 'llm'] },
      ],
    )
    assert.strictEqual(result.proposal.summary, 'Local AI suggested tags for 2 bookmark(s).')
    assert(result.warnings.includes('Dropped new tag "x" because it was suggested for only one bookmark.'))
    assert(result.warnings.includes('Dropped new tag "solo" because it was suggested for only one bookmark.'))
  })
  test('limits bookmark context and reports omitted bookmark rows', () => {
    const prompt = createBookmarkCleanupPrompt(managerModel, 'full', { bookmarkLimit: 2 })
    const payload = createBookmarkCleanupPromptPayload(managerModel, { bookmarkLimit: 2, includeFolders: false })
    assert(prompt.includes('Bookmark context: included 2 of 3 bookmarks. Omitted 1'))
    assert(prompt.includes('1 | OpenAI Docs'))
    assert(prompt.includes('2 | Duplicate OpenAI Docs'))
    assert(!prompt.includes('3 | Different Docs'))
    assert.strictEqual(payload.includedBookmarkCount, 2)
    assert.strictEqual(payload.omittedBookmarkCount, 1)
    assert.strictEqual(payload.totalBookmarkCount, 3)
    assert.strictEqual(payload.truncatedByCharacterBudget, false)
  })
  test('can focus a prompt on title changes', () => {
    const prompt = createBookmarkCleanupPrompt(managerModel, 'full', { changeFocus: 'title' })
    assert(prompt.includes('Change type focus: Title'))
    assert(prompt.includes('Include only these change arrays when they have proposals: rewriteTitles'))
    assert(prompt.includes('"changes":{"rewriteTitles"'))
    assert(prompt.includes('"rewriteTitles":[{"id":"rewrite-1"'))
    assert(prompt.includes('Do not rewrite short, clear, or already useful titles'))
    assert(prompt.includes('looks like an unedited webpage title'))
    assert(prompt.includes('A medium-confidence improvement is acceptable'))
    assert(prompt.includes('Strip boilerplate prefixes'))
    assert(prompt.includes('Do not guess the rest of a truncated word'))
    assert(!prompt.includes('Add useful, specific tags'))
    assert(!prompt.includes('Use renameTags for tag merges'))
    assert(!prompt.includes('Use only folder IDs'))
    assert(!prompt.includes('Do not delete a bookmark'))
  })
  test('omits folder context when advanced prompt only focuses tags', () => {
    const prompt = createBookmarkCleanupPrompt(managerModel, 'full', { changeFocus: 'tags' })
    assert(prompt.includes('Change type focus: Tags'))
    assert(prompt.includes('id | title | url | tags'))
    assert(prompt.includes('Add useful, concise, lowercase tags'))
    assert(prompt.includes('Strongly prefer tags that already exist'))
    assert(prompt.includes('For already-tagged bookmarks, suggest at most 1–2'))
    assert(prompt.includes('For bookmarks with no tags, suggest at most 1–3'))
    assert(prompt.includes('Use one renameTags entry per source tag'))
    assert(prompt.includes('Mutually exclusive: if you use renameTags'))
    assert(prompt.includes('they are intentional search synonyms'))
    assert(!prompt.includes('Rewrite titles only when'))
    assert(!prompt.includes('Do not rewrite titles for style alone'))
    assert(!prompt.includes('Delete only exact or near-exact duplicate bookmarks'))
    assert(!prompt.includes('Existing folders'))
    assert(!prompt.includes('dev | Development'))
  })
  test('keeps folder context when advanced prompt focuses folder structure', () => {
    const prompt = createBookmarkCleanupPrompt(managerModel, 'full', { changeFocus: 'folder' })
    assert(prompt.includes('Change type focus: Folder Structure'))
    assert(prompt.includes('id | title | url | folderId | folderPath | tags'))
    assert(prompt.includes('Existing folders'))
    assert(prompt.includes('dev | Development'))
    assert(prompt.includes('Move a bookmark only when the target folder is clearly more specific'))
    assert(prompt.includes('Use only folder IDs'))
    assert(!prompt.includes('Add useful, specific tags'))
    assert(!prompt.includes('Rewrite titles only when'))
    assert(!prompt.includes('Delete only exact or near-exact duplicate bookmarks'))
  })
  test('can focus an advanced prompt on duplicate cleanup', () => {
    const prompt = createBookmarkCleanupPrompt(managerModel, 'full', { changeFocus: 'duplicates' })
    assert(prompt.includes('Change type focus: Duplicates'))
    assert(prompt.includes('Include only these change arrays when they have proposals: deleteBookmarks'))
    assert(prompt.includes('"changes":{"deleteBookmarks"'))
    assert(prompt.includes('"deleteBookmarks":[{"id":"delete-1"'))
    assert(prompt.includes('Delete only bookmarks from the listed duplicate groups'))
    assert(prompt.includes('When in doubt, do not propose deletion'))
    assert(prompt.includes('one per line as: suggestedKeepId | otherIds | url\n1 | 2 | platform.openai.com/docs'))
    assert(prompt.includes('belong to the same listed duplicate group'))
    assert(!prompt.includes('Every targetFolderId exists'))
    assert(!prompt.includes('Add useful, specific tags'))
    assert(!prompt.includes('Rewrite titles only when'))
    assert(!prompt.includes('Use only folder IDs'))
  })
  test('reports when an advanced duplicate prompt has no duplicate groups', () => {
    const prompt = createBookmarkCleanupPrompt({ ...managerModel, duplicateGroups: [] }, 'full', {
      changeFocus: 'duplicates',
    })
    assert(prompt.includes('Duplicate groups: none.'))
  })
  test('uses folder list labels for bookmark folder paths', () => {
    const prompt = createBookmarkCleanupPrompt(
      {
        ...managerModel,
        folderOptions: [
          { id: 'dev', label: 'Bar / Development' },
          { id: 'read', label: 'Bar / Read Later' },
        ],
      },
      'full',
    )
    assert(prompt.includes('1 | OpenAI Docs | platform.openai.com/docs | dev | Bar / Development | ai'))
    assert(prompt.includes('dev | Bar / Development'))
  })
  test('repeats output requirements after the data in advanced prompts', () => {
    const prompt = createBookmarkCleanupPrompt(managerModel, 'full')
    assert(prompt.endsWith('only IDs from the provided data, and no empty change arrays.'))
    assert(prompt.indexOf('## Reminder') > prompt.indexOf('3 | Different Docs'))
    assert(prompt.includes('full JSON Schema for the output is at https://tinyurl.com/sbht-change'))
    assert(!createBookmarkCleanupPrompt(managerModel, 'lite').includes('tinyurl'))
  })
  test('builds a flat local AI schema with only allowed change types', () => {
    const fullSchema = createLocalAiBookmarkCleanupProposalSchema('full')
    const titleSchema = createLocalAiBookmarkCleanupProposalSchema('full', { changeFocus: 'title' })
    const liteSchema = createLocalAiBookmarkCleanupProposalSchema('lite')
    const serialized = JSON.stringify(fullSchema)
    assert.deepStrictEqual(Object.keys(fullSchema.properties.changes.properties), [
      'addTags',
      'removeTags',
      'renameTags',
      'moveBookmarks',
      'deleteBookmarks',
      'rewriteTitles',
    ])
    assert(fullSchema.properties.changes.properties.addTags.items.properties.reason)
    assert.deepStrictEqual(Object.keys(titleSchema.properties.changes.properties), ['rewriteTitles'])
    assert.deepStrictEqual(liteSchema.required, ['suggestions'])
    assert.deepStrictEqual(liteSchema.properties.suggestions.items.required, ['bookmarkId', 'tags'])
    assert(!JSON.stringify(liteSchema).includes('summary'))
    assert(!serialized.includes('"$ref"'))
    assert(!serialized.includes('"$defs"'))
    assert(!serialized.includes('"allOf"'))
  })
  test('creates a bulk cleanup confirmation summary with destructive warnings', () => {
    const message = createBookmarkCleanupApplyConfirmation([
      { type: 'addTags', change: { id: 'add-1' } },
      { type: 'moveBookmarks', change: { id: 'move-1' } },
      { type: 'deleteBookmarks', change: { id: 'delete-1' } },
    ])
    assert(message.includes('Apply 3 bookmark cleanup changes?'))
    assert(message.includes('Add tags: 1'))
    assert(message.includes('Move bookmarks: 1'))
    assert(message.includes('Delete bookmarks: 1'))
    assert(message.includes('destructive or structural bookmark changes'))
    assert(message.includes('Undo history is memory-only'))
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
    assert.deepStrictEqual(proposal.changes.addTags[0].tags, ['docs', 'ai'])
    assert.strictEqual(proposal.changes.rewriteTitles[0].title, 'OpenAI Docs Reference')
    assert.strictEqual(countBookmarkCleanupChanges(proposal), 5)
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
    assert.deepStrictEqual(proposal.changes.addTags, [])
    assert.strictEqual(proposal.changes.rewriteTitles.length, 1)
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
    assert.deepStrictEqual(errors, [
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
    assert.deepStrictEqual(errors, [
      'changes.deleteBookmarks[0] must reference bookmarks from the same duplicate URL group.',
    ])
  })
  test('accepts URL variant duplicates but rejects deleting a different hash route', () => {
    const proposeDeletion = (keepUrl, deleteUrl) =>
      parseBookmarkCleanupProposalWithIssues(
        JSON.stringify({
          changes: { deleteBookmarks: [{ id: 'delete', bookmarkId: '2', duplicateOfBookmarkId: '1' }] },
        }),
        {
          bookmarks: [
            { originalId: '1', originalUrl: keepUrl, url: cleanUpUrl(keepUrl) },
            { originalId: '2', originalUrl: deleteUrl, url: cleanUpUrl(deleteUrl) },
          ],
        },
      ).proposal.changes.deleteBookmarks

    assert.strictEqual(proposeDeletion('https://example.com/docs', 'http://www.example.com/docs/').length, 1)
    assert.deepStrictEqual(proposeDeletion('https://example.com/docs#install', 'https://example.com/docs#config'), [])
    assert.deepStrictEqual(proposeDeletion('https://app.example.com/#/inbox', 'https://app.example.com/'), [])
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
    assert.deepStrictEqual(errors, ['changes.deleteBookmarks would delete every bookmark in duplicate group: 1, 2.'])
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
    assert.deepStrictEqual(result.errors, [])
    assert.deepStrictEqual(result.proposal.changes.addTags, [
      { id: 'add-1', bookmarkId: '1', tags: ['docs'], reason: 'Valid.' },
    ])
    assert.deepStrictEqual(result.proposal.changes.rewriteTitles, [
      { id: 'rewrite-1', bookmarkId: '1', title: 'OpenAI Docs', reason: 'Short title.' },
    ])
    assert.deepStrictEqual(result.warnings, [
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
    assert.deepStrictEqual(result.errors, [])
    assert.deepStrictEqual(result.proposal.changes.deleteBookmarks, [])
    assert.deepStrictEqual(result.warnings, [
      'changes.deleteBookmarks ignored for duplicate group 1, 2 because it would delete every copy.',
    ])
  })
})
