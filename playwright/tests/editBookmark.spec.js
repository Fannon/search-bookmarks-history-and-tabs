import { test, expect, expectNoClientErrors } from './fixtures.js'

const BOOKMARK_STORAGE_KEY = '__playwright_bookmark_tree__'
const BOOKMARK_ID = '23'
const BOOKMARK_WITHOUT_TAGS_ID = '29'
const DEFAULT_HASH = `#bookmark/${BOOKMARK_ID}/search/t`
const EDIT_PAGE_PATH = '/editBookmark.html'

const BOOKMARK_FIXTURE_TREE = [
  {
    id: '0',
    title: '',
    dateAdded: 1627243998992,
    children: [
      {
        id: '1',
        title: 'Bookmarks Bar',
        dateAdded: 1627219418121,
        children: [
          {
            id: '5',
            title: 'Tools',
            dateAdded: 1627219418121,
            children: [
              {
                id: BOOKMARK_ID,
                parentId: '5',
                index: 0,
                title: 'Try pandoc! #md',
                url: 'https://pandoc.org/try/',
                dateAdded: 1627220684101,
              },
              {
                id: BOOKMARK_WITHOUT_TAGS_ID,
                parentId: '5',
                index: 1,
                title: 'Edit playground reference',
                url: 'https://example.com/reference',
                dateAdded: 1627220684102,
              },
            ],
          },
        ],
      },
      {
        id: '2',
        title: 'Other Bookmarks',
        dateAdded: 1627219418121,
        children: [],
      },
    ],
  },
]

const installChromeMock = (() => {
  let installed = false

  return async (page) => {
    if (installed) {
      return
    }

    await page.addInitScript(
      ({ initialTree, storageKey }) => {
        const initialTreeJson = JSON.stringify(initialTree)
        const clone = (value) => JSON.parse(JSON.stringify(value))

        const ensureState = () => {
          if (!sessionStorage.getItem(storageKey)) {
            sessionStorage.setItem(storageKey, initialTreeJson)
          }
        }

        const readTree = () => {
          ensureState()
          return JSON.parse(sessionStorage.getItem(storageKey))
        }

        const writeTree = (tree) => {
          sessionStorage.setItem(storageKey, JSON.stringify(tree))
        }

        const findNode = (nodes, targetId) => {
          for (const node of nodes) {
            if (node.id === targetId) {
              return node
            }

            if (node.children && node.children.length) {
              const match = findNode(node.children, targetId)
              if (match) {
                return match
              }
            }
          }

          return null
        }

        const removeNode = (nodes, targetId) => {
          for (let i = 0; i < nodes.length; i += 1) {
            const node = nodes[i]
            if (node.id === targetId) {
              nodes.splice(i, 1)
              return true
            }

            if (node.children && node.children.length) {
              const removed = removeNode(node.children, targetId)
              if (removed) {
                return true
              }
            }
          }

          return false
        }

        window.__resetMockBookmarks = () => {
          sessionStorage.setItem(storageKey, initialTreeJson)
        }

        const bookmarksApi = {
          async getTree() {
            return clone(readTree())
          },
          async update(id, changes = {}) {
            const tree = readTree()
            const node = findNode(tree, id)

            if (!node) {
              return undefined
            }

            if (Object.prototype.hasOwnProperty.call(changes, 'title')) {
              node.title = changes.title
            }

            if (Object.prototype.hasOwnProperty.call(changes, 'url')) {
              node.url = changes.url
            }

            writeTree(tree)
            return clone(node)
          },
          async remove(id) {
            const tree = readTree()
            if (removeNode(tree, id)) {
              writeTree(tree)
            }
          },
        }

        const chromeStub = {
          bookmarks: bookmarksApi,
          history: {
            async search() {
              return []
            },
          },
          tabs: {
            async query() {
              return []
            },
          },
          runtime: {},
        }

        Object.defineProperty(window, 'chrome', {
          value: chromeStub,
          configurable: true,
        })

        Object.defineProperty(window, 'browser', {
          value: chromeStub,
          configurable: true,
        })
      },
      { initialTree: BOOKMARK_FIXTURE_TREE, storageKey: BOOKMARK_STORAGE_KEY },
    )

    installed = true
  }
})()

const waitForTagify = (page) => page.waitForFunction(() => window.ext?.tagify)

const gotoEditBookmark = async (page, hash) => {
  await page.goto(`${EDIT_PAGE_PATH}${hash}`)
  await waitForTagify(page)
}

const addTag = async (page, tag) => {
  // Use Tagify's API to add tags instead of interacting with the hidden textarea
  await page.evaluate((tagValue) => {
    window.ext.tagify.addTags([tagValue])
  }, tag)
}

test.describe('Edit Bookmark View', () => {
  test.beforeEach(async ({ page }) => {
    await installChromeMock(page)
    await gotoEditBookmark(page, DEFAULT_HASH)
    await page.evaluate(() => window.__resetMockBookmarks())
    await gotoEditBookmark(page, DEFAULT_HASH)
  })

  test('prefills bookmark fields and tag list with existing data', async ({ page }) => {
    await expect(page.locator('#bookmark-title')).toHaveValue('Try pandoc!')
    await expect(page.locator('#bookmark-url')).toHaveValue('https://pandoc.org/try')

    const tagValues = await page.evaluate(() => window.ext.tagify.value.map((tag) => tag.value))
    expect(tagValues).toEqual(['md'])
    await expectNoClientErrors(page)
  })

  test('saves updated bookmark details and renders new tags in search results', async ({ page }) => {
    await page.locator('#bookmark-title').fill('Pandoc Playground')
    await page.locator('#bookmark-url').fill('https://pandoc.org/playground')
    await page.evaluate(() => window.ext.tagify.removeAllTags())
    await addTag(page, 'markdown')
    await addTag(page, 'docs')

    await Promise.all([
      page.waitForURL(/#search\/t$/),
      page.locator('#edit-bookmark-save').click(),
    ])

    await page.waitForSelector('#result-list [x-original-id="23"]')
    const bookmarkRow = page.locator('#result-list [x-original-id="23"]')
    await expect(bookmarkRow.locator('.title')).toContainText('Pandoc Playground')
    await expect(bookmarkRow.locator('.url')).toContainText('pandoc.org/playground')
    await expect(bookmarkRow.locator('.badge.tags').nth(0)).toContainText('#markdown')
    await expect(bookmarkRow.locator('.badge.tags').nth(1)).toContainText('#docs')
    await expect(bookmarkRow).not.toContainText('#md')
    await expectNoClientErrors(page)
  })

  test('supports adding tags to previously untagged bookmarks', async ({ page }) => {
    await gotoEditBookmark(page, `#bookmark/${BOOKMARK_WITHOUT_TAGS_ID}/search/reference`)

    const initialTags = await page.evaluate(() => window.ext.tagify.value)
    expect(initialTags).toEqual([])

    await addTag(page, 'first-tag')
    await addTag(page, 'second-tag')

    await Promise.all([
      page.waitForURL(/#search\/reference$/),
      page.locator('#edit-bookmark-save').click(),
    ])

    await page.waitForSelector('#result-list [x-original-id="29"]')
    const bookmarkRow = page.locator('#result-list [x-original-id="29"]')
    await expect(bookmarkRow.locator('.badge.tags').nth(0)).toContainText('#first-tag')
    await expect(bookmarkRow.locator('.badge.tags').nth(1)).toContainText('#second-tag')
    await expectNoClientErrors(page)
  })
})
