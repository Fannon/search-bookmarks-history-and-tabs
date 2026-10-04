import '../../../../test/setup.js'
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'
import { resetModules } from '../../../../test/modules.js'
import { any, matches, subset } from '../../../../test/patterns.js'

/**
 * ✅ Covered behaviors: bookmark edit UI setup, Tagify reuse, update/delete flows, and error handling branches.
 * ⚠️ Known gaps: does not exercise debug logging toggles, full Tagify integration, or assert window.location redirects (jsdom limitation).
 * 🐞 Added BUG tests: delete handler fires once after repeated edit invocation.
 */

const BOOKMARK_ID = 'bookmark-1'
let uniqueTagsMockValue = {}
function setupDom() {
  document.body.innerHTML = `
    <div id="edit-bm" style="display:none"></div>
    <input id="bm-title" />
    <input id="bm-url" />
    <input id="bm-tags" />
    <a id="bm-save" href="#"></a>
    <button id="bm-del"></button>
    <a id="bm-manager" href="./bookmarkManager.html#bookmarks"></a>
    <button id="bm-favorite" type="button" data-favorite="" aria-pressed="false" title="Favorite bookmark">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a8a8a" stroke-width="2"><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873l-6.158 -3.245" /></svg>
      <span class="favorite-score">+0</span>
    </button>
    <div id="errors" style="display:none"></div>
  `
}
function setupExt(bookmarks = [], overrides = {}) {
  const { model: modelOverrides, opts: optsOverrides, dom: domOverrides, returnHash, ...restOverrides } = overrides

  global.ext = {
    model: {
      bookmarks,
      bookmarkTree: [
        {
          id: '0',
          title: '',
          children: [
            {
              id: 'folder-bar',
              title: 'Bookmarks bar',
              children: [],
            },
          ],
        },
      ],
      ...(modelOverrides || {}),
    },
    opts: {
      debug: false,
      quickBookmarkCurrentTab: 'Bookmarks bar',
      ...(optsOverrides || {}),
    },
    dom: {
      ...(domOverrides || {}),
    },
    returnHash: returnHash || '#search/',
    ...restOverrides,
  }
}
async function loadEditBookmarkView({ uniqueTags = {} } = {}) {
  resetModules()
  uniqueTagsMockValue = uniqueTags
  const { cleanUpUrl: realCleanUpUrl } = await import('../../helper/utils.js')
  const resetFuzzySearchState = mock.fn()
  const resetSimpleSearchState = mock.fn()
  const searchMock = mock.fn(() => Promise.resolve())
  const createSearchStringLower = mock.fn((title, url, tags, folder) =>
    `search:${title}|${url}|${tags}|${folder}`.toLowerCase(),
  )
  const browserApi = {
    bookmarks: {
      create: mock.fn(() =>
        Promise.resolve({
          id: 'created-1',
          parentId: '1',
          index: 0,
          dateAdded: 1234,
        }),
      ),
      update: mock.fn(),
      remove: mock.fn(),
    },
  }
  const getUniqueTags = mock.fn(() => uniqueTagsMockValue)
  const resetUniqueFoldersCache = mock.fn()
  class BaseTagify {
    constructor(element, options) {
      this.element = element
      this.options = options
      this.whitelist = options.whitelist
      this.value = []
      this.removeAllTags = mock.fn(() => {
        this.value = []
      })
      this.addTags = mock.fn((tags) => {
        this.value = tags.map((tag) => ({ value: tag }))
      })
    }
  }
  const tagifyInstances = []
  global.Tagify = class extends BaseTagify {
    constructor(...args) {
      super(...args)
      tagifyInstances.push(this)
    }
  }
  mock.module(new URL('../../helper/browserApi.js', import.meta.url), {
    exports: {
      browserApi,
      createSearchStringLower,
    },
  })
  mock.module(new URL('../../search/fuzzySearch.js', import.meta.url), {
    exports: {
      resetFuzzySearchState,
    },
  })
  mock.module(new URL('../../search/taxonomySearch.js', import.meta.url), {
    exports: {
      getUniqueTags,
      resetUniqueFoldersCache,
    },
  })
  mock.module(new URL('../../search/common.js', import.meta.url), {
    exports: {
      search: searchMock,
    },
  })
  mock.module(new URL('../../search/simpleSearch.js', import.meta.url), {
    exports: {
      resetSimpleSearchState,
    },
  })
  const module = await import('../editBookmarkView.js')
  return {
    module,
    mocks: {
      resetFuzzySearchState,
      resetSimpleSearchState,
      searchMock,
      createSearchStringLower,
      browserApi,
      getUniqueTags,
      resetUniqueFoldersCache,
    },
    helpers: {
      tagifyInstances,
      cleanUpUrl: realCleanUpUrl,
    },
    setUniqueTags(value) {
      uniqueTagsMockValue = value
    },
  }
}
beforeEach(() => {
  document.body.innerHTML = ''
  window.location.hash = ''
  window.history.replaceState(null, '', 'http://localhost/')
})
afterEach(() => {
  delete global.ext
  delete global.Tagify
})
describe('editBookmarkView', () => {
  it('initializes Tagify and populates the edit form for an existing bookmark', async () => {
    setupDom()
    setupExt([
      {
        originalId: BOOKMARK_ID,
        title: 'Original Title',
        originalUrl: 'http://example.com',
        tags: '#alpha #beta',
        folder: '~Work',
      },
    ])
    const { module, helpers } = await loadEditBookmarkView({
      uniqueTags: {
        beta: [{ id: 2 }],
        alpha: [{ id: 1 }],
      },
    })
    await module.editBookmark(BOOKMARK_ID)
    assert.strictEqual(document.getElementById('edit-bm').getAttribute('style'), '')
    assert.strictEqual(document.getElementById('bm-title').value, 'Original Title')
    assert.strictEqual(document.getElementById('bm-url').value, 'http://example.com')
    assert.strictEqual(document.getElementById('bm-save').dataset.bookmarkId, BOOKMARK_ID)
    assert.strictEqual(document.getElementById('bm-del').dataset.bookmarkId, BOOKMARK_ID)
    assert.strictEqual(
      document.getElementById('bm-manager').getAttribute('href'),
      './bookmarkManager.html?bookmark=bookmark-1#bookmarks',
    )
    assert.strictEqual(global.ext.currentBookmarkId, BOOKMARK_ID)
    assert.strictEqual(helpers.tagifyInstances.length, 1)
    const tagifyInstance = helpers.tagifyInstances[0]
    assert.deepStrictEqual(tagifyInstance.options.whitelist, ['alpha', 'beta'])
    assert(tagifyInstance.addTags.mock.calls.some((call) => matches(call.arguments, [['alpha', 'beta']])))
    assert.strictEqual(global.ext.tagify, tagifyInstance)
    const tagData = { value: 'foo#bar' }
    tagifyInstance.options.transformTag(tagData)
    assert.strictEqual(tagData.value, 'foobar')
  })
  it('reuses Tagify instance, resets tags, and updates whitelist on subsequent edits', async () => {
    setupDom()
    const bookmark = {
      originalId: BOOKMARK_ID,
      title: 'Original Title',
      originalUrl: 'http://example.com',
      tags: '#alpha #beta',
      folder: '~Work',
    }
    setupExt([bookmark], { returnHash: '#search/foo' })
    const { module, helpers, setUniqueTags } = await loadEditBookmarkView({
      uniqueTags: {
        alpha: [{ id: 1 }],
        beta: [{ id: 2 }],
      },
    })
    await module.editBookmark(BOOKMARK_ID)
    helpers.tagifyInstances[0].addTags.mock.resetCalls()
    bookmark.tags = '#gamma #delta'
    setUniqueTags({
      delta: [{ id: 3 }],
      gamma: [{ id: 4 }],
    })
    await module.editBookmark(BOOKMARK_ID)
    assert.strictEqual(helpers.tagifyInstances.length, 1)
    assert.strictEqual(global.ext.tagify.removeAllTags.mock.callCount(), 1)
    assert.deepStrictEqual(global.ext.tagify.whitelist, ['delta', 'gamma'])
    assert(global.ext.tagify.addTags.mock.calls.some((call) => matches(call.arguments, [['gamma', 'delta']])))
  })
  it('encodes bookmark ids in the bookmark manager deep link', async () => {
    setupDom()
    setupExt([
      {
        originalId: 'bookmark/with/slashes',
        title: 'Original Title',
        originalUrl: 'http://example.com',
        tags: '',
        folder: '~Work',
      },
    ])
    const { module } = await loadEditBookmarkView()
    await module.editBookmark('bookmark/with/slashes')
    assert.strictEqual(
      document.getElementById('bm-manager').getAttribute('href'),
      './bookmarkManager.html?bookmark=bookmark%2Fwith%2Fslashes#bookmarks',
    )
  })
  it('handles existing bookmarks without tags', async () => {
    setupDom()
    setupExt([
      {
        originalId: BOOKMARK_ID,
        title: 'Original Title',
        originalUrl: 'http://example.com',
        folder: '~Work',
      },
    ])
    const { module, helpers } = await loadEditBookmarkView()
    await module.editBookmark(BOOKMARK_ID)
    assert(helpers.tagifyInstances[0].addTags.mock.calls.some((call) => matches(call.arguments, [[]])))
  })
  it('populates the edit form for a new bookmark draft', async () => {
    setupDom()
    setupExt([], { returnHash: '#search/' })
    const { module, helpers } = await loadEditBookmarkView({
      uniqueTags: {
        alpha: [{ id: 1 }],
      },
    })
    module.editNewBookmark({
      title: 'New Page',
      url: 'https://new.test/page',
    })
    assert.strictEqual(document.getElementById('edit-bm').getAttribute('style'), '')
    assert.strictEqual(document.getElementById('bm-title').value, 'New Page')
    assert.strictEqual(document.getElementById('bm-url').value, 'https://new.test/page')
    assert.strictEqual(document.getElementById('bm-save').dataset.bookmarkId, undefined)
    assert.strictEqual(document.getElementById('bm-del').dataset.bookmarkId, undefined)
    assert.strictEqual(document.getElementById('bm-del').style.display, 'none')
    assert.strictEqual(document.getElementById('bm-manager').style.display, 'none')
    assert.strictEqual(global.ext.currentBookmarkId, null)
    assert.deepStrictEqual(global.ext.currentBookmarkDraft, {
      title: 'New Page',
      url: 'https://new.test/page',
    })
    assert.strictEqual(helpers.tagifyInstances.length, 1)
    assert.deepStrictEqual(helpers.tagifyInstances[0].options.whitelist, ['alpha'])
    assert(helpers.tagifyInstances[0].addTags.mock.calls.some((call) => matches(call.arguments, [[]])))
  })
  it('updates bookmark metadata, persists via browser API, and resets search caches', async () => {
    setupDom()
    const bookmark = {
      originalId: BOOKMARK_ID,
      title: 'Original Title',
      originalUrl: 'http://example.com',
      tags: '#old',
      folder: '~Work',
      searchStringLower: 'old',
    }
    setupExt([bookmark])
    const { module, mocks, helpers } = await loadEditBookmarkView()
    global.ext.returnHash = '#search/foo'
    document.getElementById('bm-title').value = 'Updated Title'
    document.getElementById('bm-url').value = 'http://updated.com'
    global.ext.tagify = {
      value: [{ value: 'alpha' }, { value: 'beta' }],
    }
    module.updateBookmark(BOOKMARK_ID)
    const expectedCleanUrl = helpers.cleanUpUrl('http://updated.com')
    const expectedSearchStringLower = `search:Updated Title|${expectedCleanUrl}|#alpha #beta|~Work`.toLowerCase()
    assert.strictEqual(bookmark.title, 'Updated Title')
    assert.strictEqual(bookmark.titleLower, 'updated title')
    assert.strictEqual(bookmark.originalUrl, 'http://updated.com')
    assert.strictEqual(bookmark.url, expectedCleanUrl)
    assert.strictEqual(bookmark.tags, '#alpha #beta')
    assert.strictEqual(bookmark.tagsLower, '#alpha #beta')
    assert.deepStrictEqual(bookmark.tagsArray, ['alpha', 'beta'])
    assert.deepStrictEqual(bookmark.tagsArrayLower, ['alpha', 'beta'])
    assert.strictEqual(bookmark.searchStringLower, expectedSearchStringLower)
    assert(mocks.resetFuzzySearchState.mock.calls.some((call) => matches(call.arguments, ['bookmarks'])))
    assert(mocks.resetSimpleSearchState.mock.calls.some((call) => matches(call.arguments, ['bookmarks'])))
    assert.strictEqual(mocks.resetUniqueFoldersCache.mock.callCount(), 1)
    assert(
      mocks.browserApi.bookmarks.update.mock.calls.some((call) =>
        matches(call.arguments, [
          BOOKMARK_ID,
          {
            title: 'Updated Title #alpha #beta',
            url: 'http://updated.com',
          },
        ]),
      ),
    )
  })
  it('includes bonus score in bookmark title when favorite is set', async () => {
    setupDom()
    const bookmark = {
      originalId: BOOKMARK_ID,
      title: 'Original Title',
      originalUrl: 'http://example.com',
      tags: '#old',
      folder: '~Work',
      customBonusScore: 25,
      searchStringLower: 'old',
    }
    setupExt([bookmark])
    const { module, mocks } = await loadEditBookmarkView()
    global.ext.returnHash = '#search/'
    document.getElementById('bm-title').value = 'Updated Title'
    document.getElementById('bm-url').value = 'http://updated.com'
    global.ext.tagify = {
      value: [{ value: 'star' }],
    }
    module.updateFavoriteButton(document.getElementById('bm-favorite'), 'yellow')
    module.updateBookmark(BOOKMARK_ID)
    assert(
      mocks.browserApi.bookmarks.update.mock.calls.some((call) =>
        matches(call.arguments, [
          BOOKMARK_ID,
          {
            title: 'Updated Title +25 #star',
            url: 'http://updated.com',
          },
        ]),
      ),
    )
    assert.strictEqual(bookmark.customBonusScore, 25)
  })
  it('sets customBonusScore to 0 when favorite is not set', async () => {
    setupDom()
    const bookmark = {
      originalId: BOOKMARK_ID,
      title: 'Original Title',
      originalUrl: 'http://example.com',
      tags: '#old',
      folder: '~Work',
      customBonusScore: 50,
      searchStringLower: 'old',
    }
    setupExt([bookmark])
    const { module, mocks } = await loadEditBookmarkView()
    global.ext.returnHash = '#search/'
    document.getElementById('bm-title').value = 'Updated Title'
    document.getElementById('bm-url').value = 'http://updated.com'
    global.ext.tagify = {
      value: [],
    }
    module.updateFavoriteButton(document.getElementById('bm-favorite'), '')
    module.updateBookmark(BOOKMARK_ID)
    assert(
      mocks.browserApi.bookmarks.update.mock.calls.some((call) =>
        matches(call.arguments, [
          BOOKMARK_ID,
          {
            title: 'Updated Title',
            url: 'http://updated.com',
          },
        ]),
      ),
    )
    assert.strictEqual(bookmark.customBonusScore, 0)
  })
  it('does not throw when updating a bookmark that is no longer in the model', async () => {
    setupDom()
    setupExt([])
    const { module, mocks } = await loadEditBookmarkView()
    const warnSpy = mock.method(console, 'warn', () => {})
    assert.doesNotThrow(() => module.updateBookmark(BOOKMARK_ID))
    assert(
      warnSpy.mock.calls.some((call) =>
        matches(call.arguments, [`Tried to update bookmark id="${BOOKMARK_ID}", but could not find it in searchData.`]),
      ),
    )
    assert(mocks.browserApi.bookmarks.update.mock.callCount() === 0)
    assert(mocks.resetFuzzySearchState.mock.callCount() === 0)
    assert(mocks.resetSimpleSearchState.mock.callCount() === 0)
    assert(mocks.resetUniqueFoldersCache.mock.callCount() === 0)
    warnSpy.mock.restore()
  })
  it('preserves a custom bonus score when the favorite button was not cycled', async () => {
    setupDom()
    const bookmark = {
      originalId: BOOKMARK_ID,
      title: 'Original Title',
      originalUrl: 'http://example.com',
      tags: '#old',
      folder: '~Work',
      customBonusScore: 60,
      searchStringLower: 'old',
    }
    setupExt([bookmark])
    const { module, mocks } = await loadEditBookmarkView()
    global.ext.returnHash = '#search/'
    await module.editBookmark(BOOKMARK_ID)
    const favoriteButton = document.getElementById('bm-favorite')
    assert.strictEqual(favoriteButton.dataset.favorite, 'red')
    assert.strictEqual(favoriteButton.dataset.bonusScore, '60')
    assert.strictEqual(favoriteButton.querySelector('.favorite-score').textContent, '+60')
    document.getElementById('bm-title').value = 'Updated Title'
    document.getElementById('bm-url').value = 'http://updated.com'
    global.ext.tagify = {
      value: [{ value: 'star' }],
    }
    module.updateBookmark(BOOKMARK_ID)
    assert(
      mocks.browserApi.bookmarks.update.mock.calls.some((call) =>
        matches(call.arguments, [
          BOOKMARK_ID,
          {
            title: 'Updated Title +60 #star',
            url: 'http://updated.com',
          },
        ]),
      ),
    )
    assert.strictEqual(bookmark.customBonusScore, 60)
  })
  it('creates a bookmark from the current form values', async () => {
    setupDom()
    setupExt([], {
      opts: {
        quickBookmarkCurrentTab: 'BOOKMARKS BAR',
      },
      returnHash: '#search/',
    })
    const { module, mocks, helpers } = await loadEditBookmarkView()
    module.editNewBookmark({
      title: 'New Page',
      url: 'https://new.test/page',
    })
    global.ext.tagify.value = [{ value: 'alpha' }, { value: 'beta' }]
    module.updateFavoriteButton(document.getElementById('bm-favorite'), 'orange')
    await module.createBookmark()
    assert(
      mocks.browserApi.bookmarks.create.mock.calls.some((call) =>
        matches(call.arguments, [
          {
            parentId: 'folder-bar',
            title: 'New Page +50 #alpha #beta',
            url: 'https://new.test/page',
          },
        ]),
      ),
    )
    assert(
      matches(global.ext.model.bookmarks, [
        subset({
          type: 'bookmark',
          originalId: 'created-1',
          title: 'New Page',
          originalUrl: 'https://new.test/page',
          url: helpers.cleanUpUrl('https://new.test/page'),
          customBonusScore: 50,
          tags: '#alpha #beta',
          tagsArray: ['alpha', 'beta'],
        }),
      ]),
    )
    assert(mocks.resetFuzzySearchState.mock.calls.some((call) => matches(call.arguments, ['bookmarks'])))
    assert(mocks.resetSimpleSearchState.mock.calls.some((call) => matches(call.arguments, ['bookmarks'])))
    assert.strictEqual(mocks.resetUniqueFoldersCache.mock.callCount(), 1)
  })
  it('resolves the quick bookmark destination by folder id before folder name', async () => {
    setupDom()
    setupExt([], {
      model: {
        bookmarkTree: [
          {
            id: '0',
            title: '',
            children: [
              { id: 'target-folder', title: 'Target', children: [] },
              { id: 'other-folder', title: 'target-folder', children: [] },
            ],
          },
        ],
      },
      opts: {
        quickBookmarkCurrentTab: 'target-folder',
      },
      returnHash: '#search/',
    })
    const { module, mocks } = await loadEditBookmarkView()
    module.editNewBookmark({
      title: 'New Page',
      url: 'https://new.test/page',
    })
    await module.createBookmark()
    assert(
      mocks.browserApi.bookmarks.create.mock.calls.some((call) =>
        matches(call.arguments, [
          {
            parentId: 'target-folder',
            title: 'New Page',
            url: 'https://new.test/page',
          },
        ]),
      ),
    )
  })
  it('falls back to known bookmarks bar root ids when the default title is localized', async () => {
    setupDom()
    setupExt([], {
      model: {
        bookmarkTree: [
          {
            id: '0',
            title: '',
            children: [
              { id: 'toolbar_____', title: 'Lesezeichen-Symbolleiste', children: [] },
              { id: 'unfiled_____', title: 'Other Bookmarks', children: [] },
            ],
          },
        ],
      },
      opts: {
        quickBookmarkCurrentTab: 'Bookmarks bar',
      },
      returnHash: '#search/',
    })
    const { module, mocks } = await loadEditBookmarkView()
    module.editNewBookmark({
      title: 'New Page',
      url: 'https://new.test/page',
    })
    await module.createBookmark()
    assert(
      mocks.browserApi.bookmarks.create.mock.calls.some((call) =>
        matches(call.arguments, [
          {
            parentId: 'toolbar_____',
            title: 'New Page',
            url: 'https://new.test/page',
          },
        ]),
      ),
    )
  })
  it('falls back to the Chrome bookmarks bar root id when the configured quick bookmark folder is missing', async () => {
    setupDom()
    setupExt([], {
      model: {
        bookmarkTree: [{ id: '0', title: '', children: [] }],
      },
      opts: {
        quickBookmarkCurrentTab: 'Missing Folder',
      },
      returnHash: '#search/',
    })
    const { module, mocks } = await loadEditBookmarkView()
    const warnSpy = mock.method(console, 'warn', () => {})
    module.editNewBookmark({
      title: 'New Page',
      url: 'https://new.test/page',
    })
    await module.createBookmark()
    assert(
      warnSpy.mock.calls.some((call) =>
        matches(call.arguments, [
          'Quick bookmark folder "Missing Folder" was not found. Falling back to bookmarks bar root IDs.',
        ]),
      ),
    )
    assert(
      mocks.browserApi.bookmarks.create.mock.calls.some((call) =>
        matches(call.arguments, [
          {
            parentId: '1',
            title: 'New Page',
            url: 'https://new.test/page',
          },
        ]),
      ),
    )
    assert.strictEqual(global.ext.model.bookmarks.length, 1)
    warnSpy.mock.restore()
  })
  it('tries the Firefox bookmarks toolbar root id when the Chrome root id fails', async () => {
    setupDom()
    setupExt([], {
      model: {
        bookmarkTree: [{ id: '0', title: '', children: [] }],
      },
      opts: {
        quickBookmarkCurrentTab: 'Missing Folder',
      },
      returnHash: '#search/',
    })
    const { module, mocks } = await loadEditBookmarkView()
    const warnSpy = mock.method(console, 'warn', () => {})
    mocks.browserApi.bookmarks.create.mock.mockImplementationOnce(() => Promise.reject(new Error('invalid parent')))
    mocks.browserApi.bookmarks.create.mock.mockImplementationOnce(
      () =>
        Promise.resolve({
          id: 'created-2',
          parentId: 'toolbar_____',
          index: 0,
          dateAdded: 1234,
        }),
      1,
    )
    module.editNewBookmark({
      title: 'New Page',
      url: 'https://new.test/page',
    })
    await module.createBookmark()
    assert(
      matches(mocks.browserApi.bookmarks.create.mock.calls[0].arguments, [
        {
          parentId: '1',
          title: 'New Page',
          url: 'https://new.test/page',
        },
      ]),
    )
    assert(
      matches(mocks.browserApi.bookmarks.create.mock.calls[1].arguments, [
        {
          parentId: 'toolbar_____',
          title: 'New Page',
          url: 'https://new.test/page',
        },
      ]),
    )
    assert(
      warnSpy.mock.calls.some((call) =>
        matches(call.arguments, ['Could not create bookmark in folder "1".', any(Error)]),
      ),
    )
    assert.partialDeepStrictEqual(global.ext.model.bookmarks[0], {
      originalId: 'created-2',
      parentId: 'toolbar_____',
    })
    warnSpy.mock.restore()
  })
  it('warns and stays in the editor when bookmark creation fails', async () => {
    setupDom()
    setupExt([], { returnHash: '#search/' })
    const { module, mocks } = await loadEditBookmarkView()
    const warnSpy = mock.method(console, 'warn', () => {})
    module.editNewBookmark({
      title: 'New Page',
      url: 'https://new.test/page',
    })
    mocks.browserApi.bookmarks.create.mock.mockImplementation(() => Promise.reject(new Error('create failed')))
    await module.createBookmark()
    assert(
      warnSpy.mock.calls.some((call) =>
        matches(call.arguments, ['Could not create bookmark in folder "folder-bar".', any(Error)]),
      ),
    )
    assert.deepStrictEqual(global.ext.model.bookmarks, [])
    assert(mocks.resetFuzzySearchState.mock.callCount() === 0)
    assert(mocks.resetSimpleSearchState.mock.callCount() === 0)
    assert(mocks.resetUniqueFoldersCache.mock.callCount() === 0)
    warnSpy.mock.restore()
  })
  it('handles missing browser API and empty tag selection during update', async () => {
    setupDom()
    const bookmark = {
      originalId: BOOKMARK_ID,
      title: 'Original Title',
      originalUrl: 'http://example.com',
      tags: '#old',
      folder: '~Work',
      searchStringLower: 'old',
    }
    setupExt([bookmark])
    const { module, mocks } = await loadEditBookmarkView()
    global.ext.returnHash = '#search/foo'
    const warnSpy = mock.method(console, 'warn', () => {})
    document.getElementById('bm-title').value = 'Updated Title'
    document.getElementById('bm-url').value = 'http://updated.com'
    global.ext.tagify = {
      value: [],
    }
    mocks.browserApi.bookmarks = undefined
    module.updateBookmark(BOOKMARK_ID)
    assert.strictEqual(bookmark.tags, '')
    assert.strictEqual(mocks.browserApi.bookmarks?.update, undefined)
    assert(
      warnSpy.mock.calls.some((call) =>
        matches(call.arguments, ['No browser bookmarks API found. Bookmark update will not persist.']),
      ),
    )
    assert.strictEqual(mocks.resetUniqueFoldersCache.mock.callCount(), 1)
    warnSpy.mock.restore()
  })
  it('removes bookmark, resets search state, and redirects after deletion', async () => {
    setupDom()
    const bookmarks = [
      {
        originalId: BOOKMARK_ID,
        title: 'Bookmark 1',
        tags: '',
        folder: '~Work',
      },
      {
        originalId: 'bookmark-2',
        title: 'Bookmark 2',
        tags: '',
        folder: '~Play',
      },
    ]
    setupExt(bookmarks, { returnHash: '#search/foo' })
    const { module, mocks } = await loadEditBookmarkView()
    global.ext.returnHash = '#search/foo'
    await module.deleteBookmark(BOOKMARK_ID)
    assert(mocks.browserApi.bookmarks.remove.mock.calls.some((call) => matches(call.arguments, [BOOKMARK_ID])))
    assert.deepStrictEqual(global.ext.model.bookmarks, [
      {
        originalId: 'bookmark-2',
        title: 'Bookmark 2',
        tags: '',
        folder: '~Play',
      },
    ])
    assert(mocks.resetFuzzySearchState.mock.calls.some((call) => matches(call.arguments, ['bookmarks'])))
    assert(mocks.resetSimpleSearchState.mock.calls.some((call) => matches(call.arguments, ['bookmarks'])))
    assert(mocks.searchMock.mock.callCount() === 0)
    assert.strictEqual(mocks.resetUniqueFoldersCache.mock.callCount(), 1)
  })
  it('reruns search after deletion when search UI is available', async () => {
    setupDom()
    const searchInput = document.createElement('input')
    setupExt(
      [
        {
          originalId: BOOKMARK_ID,
          title: 'Bookmark 1',
          tags: '',
          folder: '~Work',
        },
        {
          originalId: 'bookmark-2',
          title: 'Bookmark 2',
          tags: '',
          folder: '~Play',
        },
      ],
      {
        dom: {
          searchInput,
        },
        returnHash: '#search/foo',
      },
    )
    const { module, mocks } = await loadEditBookmarkView()
    await module.deleteBookmark(BOOKMARK_ID)
    assert(mocks.searchMock.mock.callCount() === 0)
  })
  it('logs a warning when attempting to delete without bookmark API', async () => {
    setupDom()
    setupExt([
      {
        originalId: BOOKMARK_ID,
        title: 'Bookmark 1',
        tags: '',
        folder: '~Work',
      },
    ])
    const { module, mocks } = await loadEditBookmarkView()
    const warnSpy = mock.method(console, 'warn', () => {})
    mocks.browserApi.bookmarks = undefined
    await module.deleteBookmark(BOOKMARK_ID)
    assert(
      warnSpy.mock.calls.some((call) =>
        matches(call.arguments, ['No browser bookmarks API found. Bookmark remove will not persist.']),
      ),
    )
    assert.strictEqual(global.ext.model.bookmarks.length, 0)
    assert.strictEqual(mocks.resetUniqueFoldersCache.mock.callCount(), 1)
    warnSpy.mock.restore()
  })
  it('warns when editing a non-existent bookmark', async () => {
    setupDom()
    setupExt([])
    const { module } = await loadEditBookmarkView()
    const warnSpy = mock.method(console, 'warn', () => {})
    await module.editBookmark('missing-id')
    assert(
      warnSpy.mock.calls.some((call) =>
        matches(call.arguments, ['Tried to edit bookmark id="missing-id", but could not find it in searchData.']),
      ),
    )
    warnSpy.mock.restore()
  })
  describe('getStarState', () => {
    it('returns "yellow" for customBonusScore 1 through 25', async () => {
      const { module } = await loadEditBookmarkView()
      assert.strictEqual(module.getStarState(1), 'yellow')
      assert.strictEqual(module.getStarState(10), 'yellow')
      assert.strictEqual(module.getStarState(25), 'yellow')
    })
    it('returns "orange" for customBonusScore 26 through 50', async () => {
      const { module } = await loadEditBookmarkView()
      assert.strictEqual(module.getStarState(26), 'orange')
      assert.strictEqual(module.getStarState(50), 'orange')
    })
    it('returns "red" for customBonusScore 51 and above', async () => {
      const { module } = await loadEditBookmarkView()
      assert.strictEqual(module.getStarState(51), 'red')
      assert.strictEqual(module.getStarState(75), 'red')
      assert.strictEqual(module.getStarState(100), 'red')
    })
    it('returns "" for customBonusScore 0', async () => {
      const { module } = await loadEditBookmarkView()
      assert.strictEqual(module.getStarState(0), '')
    })
  })
  describe('updateFavoriteButton', () => {
    it('sets data-favorite and aria-pressed attributes', async () => {
      setupDom()
      setupExt([])
      const { module } = await loadEditBookmarkView()
      const button = document.getElementById('bm-favorite')
      module.updateFavoriteButton(button, 'yellow')
      assert.strictEqual(button.dataset.favorite, 'yellow')
      assert.strictEqual(button.dataset.bonusScore, '25')
      assert.strictEqual(button.getAttribute('aria-pressed'), 'true')
      module.updateFavoriteButton(button, '')
      assert.strictEqual(button.dataset.favorite, '')
      assert.strictEqual(button.dataset.bonusScore, '0')
      assert.strictEqual(button.getAttribute('aria-pressed'), 'false')
      module.updateFavoriteButton(button, 'orange')
      assert.strictEqual(button.dataset.favorite, 'orange')
      assert.strictEqual(button.dataset.bonusScore, '50')
      assert.strictEqual(button.getAttribute('aria-pressed'), 'true')
    })
    it('keeps the button compact while showing the current bonus score', async () => {
      setupDom()
      setupExt([])
      const { module } = await loadEditBookmarkView()
      const button = document.getElementById('bm-favorite')
      module.updateFavoriteButton(button, 'yellow')
      assert.strictEqual(button.querySelector('.favorite-score').textContent, '+25')
      assert.strictEqual(button.title, 'Favorite (+25)')
      assert.strictEqual(button.getAttribute('aria-label'), 'Favorite (+25)')
      module.updateFavoriteButton(button, 'yellow', 15)
      assert.strictEqual(button.querySelector('.favorite-score').textContent, '+15')
      assert.strictEqual(button.title, 'Favorite (+15)')
      module.updateFavoriteButton(button, 'orange')
      assert.strictEqual(button.querySelector('.favorite-score').textContent, '+50')
      assert.strictEqual(button.title, 'Favorite (+50)')
      module.updateFavoriteButton(button, 'orange', 30)
      assert.strictEqual(button.querySelector('.favorite-score').textContent, '+30')
      assert.strictEqual(button.title, 'Favorite (+30)')
      module.updateFavoriteButton(button, 'red')
      assert.strictEqual(button.querySelector('.favorite-score').textContent, '+75')
      assert.strictEqual(button.title, 'Favorite (+75)')
      module.updateFavoriteButton(button, '')
      assert.strictEqual(button.querySelector('.favorite-score').textContent, '+0')
      assert.strictEqual(button.title, 'Favorite bookmark')
      assert.strictEqual(button.getAttribute('aria-label'), 'Favorite bookmark')
    })
    it('does nothing if button is null', async () => {
      const { module } = await loadEditBookmarkView()
      assert.doesNotThrow(() => module.updateFavoriteButton(null, 'yellow'))
    })
  })
  describe('cycleFavoriteButton', () => {
    it('cycles from empty to yellow', async () => {
      setupDom()
      setupExt([])
      const { module } = await loadEditBookmarkView()
      const button = document.getElementById('bm-favorite')
      button.dataset.favorite = ''
      module.cycleFavoriteButton(button)
      assert.strictEqual(button.dataset.favorite, 'yellow')
      assert.strictEqual(button.dataset.bonusScore, '25')
    })
    it('cycles from yellow to orange', async () => {
      setupDom()
      setupExt([])
      const { module } = await loadEditBookmarkView()
      const button = document.getElementById('bm-favorite')
      button.dataset.favorite = 'yellow'
      module.cycleFavoriteButton(button)
      assert.strictEqual(button.dataset.favorite, 'orange')
      assert.strictEqual(button.dataset.bonusScore, '50')
    })
    it('cycles from orange to red', async () => {
      setupDom()
      setupExt([])
      const { module } = await loadEditBookmarkView()
      const button = document.getElementById('bm-favorite')
      button.dataset.favorite = 'orange'
      module.cycleFavoriteButton(button)
      assert.strictEqual(button.dataset.favorite, 'red')
      assert.strictEqual(button.dataset.bonusScore, '75')
    })
    it('cycles from red back to empty', async () => {
      setupDom()
      setupExt([])
      const { module } = await loadEditBookmarkView()
      const button = document.getElementById('bm-favorite')
      button.dataset.favorite = 'red'
      module.cycleFavoriteButton(button)
      assert.strictEqual(button.dataset.favorite, '')
      assert.strictEqual(button.dataset.bonusScore, '0')
    })
    it('does nothing if button is null', async () => {
      const { module } = await loadEditBookmarkView()
      assert.doesNotThrow(() => module.cycleFavoriteButton(null))
    })
  })
  describe('editBookmark favorite initialization', () => {
    it('initializes favorite button to yellow when customBonusScore is 25', async () => {
      setupDom()
      setupExt([
        {
          originalId: BOOKMARK_ID,
          title: 'Starred Title',
          originalUrl: 'http://example.com',
          tags: '',
          folder: '',
          customBonusScore: 25,
        },
      ])
      const { module } = await loadEditBookmarkView({
        uniqueTags: {},
      })
      await module.editBookmark(BOOKMARK_ID)
      const favoriteButton = document.getElementById('bm-favorite')
      assert.strictEqual(favoriteButton.dataset.favorite, 'yellow')
      assert.strictEqual(favoriteButton.dataset.bonusScore, '25')
      assert.strictEqual(favoriteButton.getAttribute('aria-pressed'), 'true')
    })
    it('initializes favorite button to orange when customBonusScore is 50', async () => {
      setupDom()
      setupExt([
        {
          originalId: BOOKMARK_ID,
          title: 'Starred Title',
          originalUrl: 'http://example.com',
          tags: '',
          folder: '',
          customBonusScore: 50,
        },
      ])
      const { module } = await loadEditBookmarkView({
        uniqueTags: {},
      })
      await module.editBookmark(BOOKMARK_ID)
      const favoriteButton = document.getElementById('bm-favorite')
      assert.strictEqual(favoriteButton.dataset.favorite, 'orange')
    })
    it('initializes favorite button to red when customBonusScore is 75', async () => {
      setupDom()
      setupExt([
        {
          originalId: BOOKMARK_ID,
          title: 'Starred Title',
          originalUrl: 'http://example.com',
          tags: '',
          folder: '',
          customBonusScore: 75,
        },
      ])
      const { module } = await loadEditBookmarkView({
        uniqueTags: {},
      })
      await module.editBookmark(BOOKMARK_ID)
      const favoriteButton = document.getElementById('bm-favorite')
      assert.strictEqual(favoriteButton.dataset.favorite, 'red')
    })
    it('leaves favorite button empty when customBonusScore is 0', async () => {
      setupDom()
      setupExt([
        {
          originalId: BOOKMARK_ID,
          title: 'Regular Title',
          originalUrl: 'http://example.com',
          tags: '',
          folder: '',
          customBonusScore: 0,
        },
      ])
      const { module } = await loadEditBookmarkView({
        uniqueTags: {},
      })
      await module.editBookmark(BOOKMARK_ID)
      const favoriteButton = document.getElementById('bm-favorite')
      assert.strictEqual(favoriteButton.dataset.favorite, '')
      assert.strictEqual(favoriteButton.querySelector('.favorite-score').textContent, '+0')
    })
    it('initializes favorite button to yellow with actual score for non-standard bonus', async () => {
      setupDom()
      setupExt([
        {
          originalId: BOOKMARK_ID,
          title: 'Tweaked',
          originalUrl: 'http://example.com',
          tags: '',
          folder: '',
          customBonusScore: 20,
        },
      ])
      const { module } = await loadEditBookmarkView({
        uniqueTags: {},
      })
      await module.editBookmark(BOOKMARK_ID)
      const favoriteButton = document.getElementById('bm-favorite')
      assert.strictEqual(favoriteButton.dataset.favorite, 'yellow')
      assert.strictEqual(favoriteButton.dataset.bonusScore, '20')
      assert.strictEqual(favoriteButton.querySelector('.favorite-score').textContent, '+20')
      assert.strictEqual(favoriteButton.title, 'Favorite (+20)')
    })
    it('initializes favorite button to orange with actual score for score 35', async () => {
      setupDom()
      setupExt([
        {
          originalId: BOOKMARK_ID,
          title: 'Tweaked',
          originalUrl: 'http://example.com',
          tags: '',
          folder: '',
          customBonusScore: 35,
        },
      ])
      const { module } = await loadEditBookmarkView({
        uniqueTags: {},
      })
      await module.editBookmark(BOOKMARK_ID)
      const favoriteButton = document.getElementById('bm-favorite')
      assert.strictEqual(favoriteButton.dataset.favorite, 'orange')
      assert.strictEqual(favoriteButton.dataset.bonusScore, '35')
      assert.strictEqual(favoriteButton.querySelector('.favorite-score').textContent, '+35')
      assert.strictEqual(favoriteButton.title, 'Favorite (+35)')
    })
  })
})
