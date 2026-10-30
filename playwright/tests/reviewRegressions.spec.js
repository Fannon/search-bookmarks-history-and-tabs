import { expect, test } from './fixtures.js'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const key = 'review-bookmarks'
    const read = () =>
      JSON.parse(
        sessionStorage.getItem(key) ||
          JSON.stringify({
            nextId: 4,
            nodes: [
              { id: '2', parentId: '1', index: 0, title: 'Original #old', url: 'https://example.test/page' },
              { id: '3', parentId: '1', index: 1, title: 'Keeper', url: 'https://example.test/page' },
            ],
          }),
      )
    const write = (state) => sessionStorage.setItem(key, JSON.stringify(state))
    window.chrome = {
      runtime: { lastError: null },
      storage: { sync: { get: (_keys, done) => done({}), set: (_value, done) => done() } },
      tabs: { query: async () => [] },
      history: { search: async () => [] },
      bookmarks: {
        getTree: async () => [
          { id: '0', title: '', children: [{ id: '1', title: 'Bookmarks bar', children: read().nodes }] },
        ],
        get: async (id) => read().nodes.filter((node) => node.id === id),
        update: async (id, changes) => {
          if (changes.url !== undefined) new URL(changes.url)
          const state = read()
          const node = state.nodes.find((node) => node.id === id)
          Object.assign(node, changes)
          write(state)
          return node
        },
        remove: async (id) => {
          const state = read()
          state.nodes = state.nodes.filter((node) => node.id !== id)
          write(state)
        },
        create: async (values) => {
          const state = read()
          const node = { parentId: '1', index: state.nodes.length, ...values, id: String(state.nextId++) }
          state.nodes.push(node)
          write(state)
          return node
        },
        move: async (id, values) => {
          const state = read()
          Object.assign(
            state.nodes.find((node) => node.id === id),
            values,
          )
          write(state)
        },
      },
    }
  })
  page.on('dialog', (dialog) => dialog.accept())
})

const openManager = async (page, route = '#cleanup') => {
  await page.goto(`/bookmarkManager.html${route}`)
  await page.waitForFunction(() => window.ext?.initialized)
}

const loadProposal = async (page, changes) => {
  await page.locator('#cleanup-proposal-json').fill(JSON.stringify({ changes }))
  await page.waitForFunction(() => window.ext.model.bookmarkCleanupProposal)
}

test('saving a bookmark through the manager preserves its Unicode tags', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => chrome.bookmarks.update('2', { title: 'Unicode #日本語 #café' }))
  await openManager(page, '?bookmark=2#bookmarks')
  await page.locator('#bookmark-edit-title').fill('Renamed')
  await page.locator('#save-managed-bookmark').click()
  await expect
    .poll(() => page.evaluate(async () => (await chrome.bookmarks.get('2'))[0].title))
    .toBe('Renamed #日本語 #café')
})

test('cleanup tag changes compose with a title rewrite', async ({ page }) => {
  await openManager(page)
  await loadProposal(page, {
    addTags: [{ id: 'add', bookmarkId: '2', tags: ['new'] }],
    removeTags: [{ id: 'remove', bookmarkId: '2', tags: ['old'] }],
    rewriteTitles: [{ id: 'rewrite', bookmarkId: '2', title: 'Rewritten' }],
  })
  await page.locator('#apply-all-cleanup-changes').click()
  await expect.poll(() => page.evaluate(() => window.ext.model.bookmarkCleanupAppliedChangeIds.size)).toBe(3)
  expect(await page.evaluate(async () => (await chrome.bookmarks.get('2'))[0].title)).toBe('Rewritten #new')
})

test('a scoped rename with no valid targets cannot rename the whole collection', async ({ page }) => {
  await openManager(page)
  await loadProposal(page, {
    renameTags: [{ id: 'rename', from: 'old', to: 'new', bookmarkIds: ['missing'] }],
  })
  await expect(page.locator('#apply-all-cleanup-changes')).toBeDisabled()
  expect(await page.evaluate(async () => (await chrome.bookmarks.get('2'))[0].title)).toBe('Original #old')
})

test('undoing a deletion keeps older undo steps attached to the restored bookmark', async ({ page }) => {
  await openManager(page, '?bookmark=2#bookmarks')
  await page.locator('#bookmark-edit-title').fill('Edited')
  await page.locator('#save-managed-bookmark').click()
  await expect.poll(() => page.evaluate(async () => (await chrome.bookmarks.get('2'))[0].title)).toBe('Edited #old')
  await page.locator('[data-manager-tab="duplicates"]').click()
  await page.locator('[data-delete-single-bookmark-id="2"]').click()
  await expect(page.locator('#undo-count')).toHaveText('2')
  await expect(page.locator('[data-delete-single-bookmark-id="2"]')).toHaveCount(0)
  await page.locator('#undo-bookmark-change').click()
  await expect(page.locator('#undo-count')).toHaveText('1')
  await page.locator('#undo-bookmark-change').click()
  await expect(page.locator('#undo-count')).toHaveText('')
  const nodes = await page.evaluate(async () => (await chrome.bookmarks.getTree())[0].children[0].children)
  expect(nodes).toHaveLength(2)
  expect(nodes.map((node) => node.title).sort()).toEqual(['Keeper', 'Original #old'])
})

test.describe('failed editor persistence', () => {
  test.use({ skipConsoleErrors: true })
  test('invalid URL saves retain edits and allow retrying', async ({ page }) => {
    await page.goto('/editBookmark.html#bookmark/2')
    await page.waitForFunction(() => window.ext?.initialized)
    await page.locator('#bm-title').fill('Unsaved')
    await page.locator('#bm-url').fill('http://')
    await page.locator('#bm-save').click()
    await expect(page.locator('#error-overlay')).toBeVisible()
    await expect(page.locator('#bm-title')).toHaveValue('Unsaved')
    expect(await page.evaluate(async () => (await chrome.bookmarks.get('2'))[0].title)).toBe('Original #old')
    await page.locator('#btn-dismiss-error').click()
    await page.locator('#bm-url').fill('https://updated.test')
    await page.locator('#bm-save').click()
    await page.waitForURL('**/index.html#search/')
    expect(await page.evaluate(async () => (await chrome.bookmarks.get('2'))[0].title)).toBe('Unsaved #old')
  })
})
