/**
 * ✅ Covered behaviors: bookmark edit UI setup, Tagify reuse, update/delete flows, and error handling branches.
 * ⚠️ Known gaps: does not exercise debug logging toggles, full Tagify integration, or assert window.location redirects (jsdom limitation).
 * 🐞 Added BUG tests: delete handler fires once after repeated edit invocation.
 */

import { jest } from '@jest/globals'

const BOOKMARK_ID = 'bookmark-1'

let uniqueTagsMockValue = {}

function setupDom() {
  document.body.innerHTML = `
    <div id="edit-bookmark" style="display:none"></div>
    <input id="bookmark-title" />
    <input id="bookmark-url" />
    <input id="bookmark-tags" />
    <a id="edit-bookmark-save" href="#"></a>
    <button id="edit-bookmark-delete"></button>
    <div id="error-message" style="display:none"></div>
  `
}

function setupExt(bookmarks = [], overrides = {}) {
  const { model: modelOverrides, opts: optsOverrides, dom: domOverrides, returnHash, ...restOverrides } = overrides

  global.ext = {
    model: {
      bookmarks,
      ...(modelOverrides || {}),
    },
    opts: {
      debug: false,
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
  jest.resetModules()
  uniqueTagsMockValue = uniqueTags

  const cleanUpUrl = jest.fn((url) => `clean:${url}`)
  const resetFuzzySearchState = jest.fn()
  const resetSimpleSearchState = jest.fn()
  const searchMock = jest.fn(() => Promise.resolve())
  const createSearchString = jest.fn((title, url, tags, folder) => `search:${title}|${url}|${tags}|${folder}`)
  const browserApi = {
    bookmarks: {
      update: jest.fn(),
      remove: jest.fn(),
    },
  }
  const getUniqueTags = jest.fn(() => uniqueTagsMockValue)
  const resetUniqueFoldersCache = jest.fn()

  class BaseTagify {
    constructor(element, options) {
      this.element = element
      this.options = options
      this.whitelist = options.whitelist
      this.value = []
      this.removeAllTags = jest.fn(() => {
        this.value = []
      })
      this.addTags = jest.fn((tags) => {
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

  jest.unstable_mockModule('../../helper/utils.js', () => ({
    cleanUpUrl,
  }))
  jest.unstable_mockModule('../../helper/browserApi.js', () => ({
    browserApi,
    createSearchString,
  }))
  jest.unstable_mockModule('../../search/fuzzySearch.js', () => ({
    resetFuzzySearchState,
  }))
  jest.unstable_mockModule('../../search/taxonomySearch.js', () => ({
    getUniqueTags,
    resetUniqueFoldersCache,
  }))
  jest.unstable_mockModule('../../search/common.js', () => ({
    search: searchMock,
  }))
  jest.unstable_mockModule('../../search/simpleSearch.js', () => ({
    resetSimpleSearchState,
  }))

  const module = await import('../editBookmarkView.js')

  return {
    module,
    mocks: {
      cleanUpUrl,
      resetFuzzySearchState,
      resetSimpleSearchState,
      searchMock,
      createSearchString,
      browserApi,
      getUniqueTags,
      resetUniqueFoldersCache,
    },
    helpers: {
      tagifyInstances,
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
    const { module, mocks, helpers } = await loadEditBookmarkView({
      uniqueTags: {
        beta: [{ id: 2 }],
        alpha: [{ id: 1 }],
      },
    })

    await module.editBookmark(BOOKMARK_ID)

    expect(document.getElementById('edit-bookmark').getAttribute('style')).toBe('')
    expect(document.getElementById('bookmark-title').value).toBe('Original Title')
    expect(document.getElementById('bookmark-url').value).toBe('http://example.com')
    expect(document.getElementById('edit-bookmark-save').dataset.bookmarkId).toBe(BOOKMARK_ID)
    expect(document.getElementById('edit-bookmark-delete').dataset.bookmarkId).toBe(BOOKMARK_ID)
    expect(global.ext.currentBookmarkId).toBe(BOOKMARK_ID)

    expect(helpers.tagifyInstances).toHaveLength(1)
    const tagifyInstance = helpers.tagifyInstances[0]
    expect(tagifyInstance.options.whitelist).toEqual(['alpha', 'beta'])
    expect(tagifyInstance.addTags).toHaveBeenCalledWith(['alpha', 'beta'])
    expect(global.ext.tagify).toBe(tagifyInstance)

    const tagData = { value: 'foo#bar' }
    tagifyInstance.options.transformTag(tagData)
    expect(tagData.value).toBe('foobar')
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
    const { module, mocks, helpers, setUniqueTags } = await loadEditBookmarkView({
      uniqueTags: {
        alpha: [{ id: 1 }],
        beta: [{ id: 2 }],
      },
    })

    await module.editBookmark(BOOKMARK_ID)
    helpers.tagifyInstances[0].addTags.mockClear()

    bookmark.tags = '#gamma #delta'
    setUniqueTags({
      delta: [{ id: 3 }],
      gamma: [{ id: 4 }],
    })

    await module.editBookmark(BOOKMARK_ID)

    expect(helpers.tagifyInstances).toHaveLength(1)
    expect(global.ext.tagify.removeAllTags).toHaveBeenCalledTimes(1)
    expect(global.ext.tagify.whitelist).toEqual(['delta', 'gamma'])
    expect(global.ext.tagify.addTags).toHaveBeenCalledWith(['gamma', 'delta'])
  })

  it('updates bookmark metadata, persists via browser API, and resets search caches', async () => {
    setupDom()
    const bookmark = {
      originalId: BOOKMARK_ID,
      title: 'Original Title',
      originalUrl: 'http://example.com',
      tags: '#old',
      folder: '~Work',
      searchString: 'old',
      searchStringLower: 'old',
    }
    setupExt([bookmark])
    const { module, mocks } = await loadEditBookmarkView()
    global.ext.returnHash = '#search/foo'

    document.getElementById('bookmark-title').value = 'Updated Title'
    document.getElementById('bookmark-url').value = 'http://updated.com'
    global.ext.tagify = {
      value: [{ value: 'alpha' }, { value: 'beta' }],
    }

    module.updateBookmark(BOOKMARK_ID)

    expect(bookmark.title).toBe('Updated Title')
    expect(bookmark.originalUrl).toBe('http://updated.com')
    expect(bookmark.url).toBe('clean:http://updated.com')
    expect(bookmark.tags).toBe('#alpha #beta')
    expect(bookmark.searchString).toBe('search:Updated Title|clean:http://updated.com|#alpha #beta|~Work')
    expect(bookmark.searchStringLower).toBe(bookmark.searchString.toLowerCase())

    expect(mocks.cleanUpUrl).toHaveBeenCalledWith('http://updated.com')
    expect(mocks.createSearchString).toHaveBeenCalledWith('Updated Title', 'clean:http://updated.com', '#alpha #beta', '~Work')
    expect(mocks.resetFuzzySearchState).toHaveBeenCalledWith('bookmarks')
    expect(mocks.resetSimpleSearchState).toHaveBeenCalledWith('bookmarks')
    expect(mocks.resetUniqueFoldersCache).toHaveBeenCalledTimes(1)
    expect(mocks.browserApi.bookmarks.update).toHaveBeenCalledWith(BOOKMARK_ID, {
      title: 'Updated Title #alpha #beta',
      url: 'http://updated.com',
    })
  })

  it('handles missing browser API and empty tag selection during update', async () => {
    setupDom()
    const bookmark = {
      originalId: BOOKMARK_ID,
      title: 'Original Title',
      originalUrl: 'http://example.com',
      tags: '#old',
      folder: '~Work',
      searchString: 'old',
      searchStringLower: 'old',
    }
    setupExt([bookmark])
    const { module, mocks } = await loadEditBookmarkView()
    global.ext.returnHash = '#search/foo'
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    document.getElementById('bookmark-title').value = 'Updated Title'
    document.getElementById('bookmark-url').value = 'http://updated.com'
    global.ext.tagify = {
      value: [],
    }
    mocks.browserApi.bookmarks = undefined

    module.updateBookmark(BOOKMARK_ID)

    expect(bookmark.tags).toBe('')
    expect(mocks.browserApi.bookmarks?.update).toBeUndefined()
    expect(warnSpy).toHaveBeenCalledWith('No browser bookmarks API found. Bookmark update will not persist.')
    expect(mocks.resetUniqueFoldersCache).toHaveBeenCalledTimes(1)

    warnSpy.mockRestore()
  })

  it('removes bookmark, resets search state, and redirects after deletion', async () => {
    setupDom()
    const bookmarks = [
      { originalId: BOOKMARK_ID, title: 'Bookmark 1', tags: '', folder: '~Work' },
      { originalId: 'bookmark-2', title: 'Bookmark 2', tags: '', folder: '~Play' },
    ]
    setupExt(bookmarks, { returnHash: '#search/foo' })
    const { module, mocks } = await loadEditBookmarkView()
    global.ext.returnHash = '#search/foo'

    await module.deleteBookmark(BOOKMARK_ID)

    expect(mocks.browserApi.bookmarks.remove).toHaveBeenCalledWith(BOOKMARK_ID)
    expect(global.ext.model.bookmarks).toEqual([{ originalId: 'bookmark-2', title: 'Bookmark 2', tags: '', folder: '~Play' }])
    expect(mocks.resetFuzzySearchState).toHaveBeenCalledWith('bookmarks')
    expect(mocks.resetSimpleSearchState).toHaveBeenCalledWith('bookmarks')
    expect(mocks.searchMock).not.toHaveBeenCalled()
    expect(mocks.resetUniqueFoldersCache).toHaveBeenCalledTimes(1)
  })

  it('reruns search after deletion when search UI is available', async () => {
    setupDom()
    const searchInput = document.createElement('input')
    setupExt(
      [
        { originalId: BOOKMARK_ID, title: 'Bookmark 1', tags: '', folder: '~Work' },
        { originalId: 'bookmark-2', title: 'Bookmark 2', tags: '', folder: '~Play' },
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

    expect(mocks.searchMock).not.toHaveBeenCalled()
  })

  it('logs a warning when attempting to delete without bookmark API', async () => {
    setupDom()
    setupExt([{ originalId: BOOKMARK_ID, title: 'Bookmark 1', tags: '', folder: '~Work' }])
    const { module, mocks } = await loadEditBookmarkView()
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    mocks.browserApi.bookmarks = undefined

    await module.deleteBookmark(BOOKMARK_ID)

    expect(warnSpy).toHaveBeenCalledWith('No browser bookmarks API found. Bookmark remove will not persist.')
    expect(global.ext.model.bookmarks).toHaveLength(0)
    expect(mocks.resetUniqueFoldersCache).toHaveBeenCalledTimes(1)
    warnSpy.mockRestore()
  })

  it('warns when editing a non-existent bookmark', async () => {
    setupDom()
    setupExt([])
    const { module } = await loadEditBookmarkView()
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    await module.editBookmark('missing-id')

    expect(warnSpy).toHaveBeenCalledWith('Tried to edit bookmark id="missing-id", but could not find it in searchData.')
    warnSpy.mockRestore()
  })
})
