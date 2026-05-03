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
    <div id="edit-bm" style="display:none"></div>
    <input id="bm-title" />
    <input id="bm-url" />
    <input id="bm-tags" />
    <a id="bm-save" href="#"></a>
    <button id="bm-del"></button>
    <button id="bm-favorite" type="button" data-favorite="" aria-pressed="false" title="Favorite bookmark">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a8a8a" stroke-width="2"><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873l-6.158 -3.245" /></svg>
      <span class="favorite-label">FAVORITE</span>
    </button>
    <div id="errors" style="display:none"></div>
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

  const { cleanUpUrl: realCleanUpUrl } = await import('../../helper/utils.js')
  const resetFuzzySearchState = jest.fn()
  const resetSimpleSearchState = jest.fn()
  const searchMock = jest.fn(() => Promise.resolve())
  const createSearchStringLower = jest.fn((title, url, tags, folder) =>
    `search:${title}|${url}|${tags}|${folder}`.toLowerCase(),
  )
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

  jest.unstable_mockModule('../../helper/browserApi.js', () => ({
    __esModule: true,
    browserApi,
    createSearchStringLower,
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

    expect(document.getElementById('edit-bm').getAttribute('style')).toBe('')
    expect(document.getElementById('bm-title').value).toBe('Original Title')
    expect(document.getElementById('bm-url').value).toBe('http://example.com')
    expect(document.getElementById('bm-save').dataset.bookmarkId).toBe(BOOKMARK_ID)
    expect(document.getElementById('bm-del').dataset.bookmarkId).toBe(BOOKMARK_ID)
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
    const { module, helpers, setUniqueTags } = await loadEditBookmarkView({
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

    expect(bookmark.title).toBe('Updated Title')
    expect(bookmark.originalUrl).toBe('http://updated.com')
    expect(bookmark.url).toBe(expectedCleanUrl)
    expect(bookmark.tags).toBe('#alpha #beta')
    expect(bookmark.searchStringLower).toBe(expectedSearchStringLower)

    expect(mocks.resetFuzzySearchState).toHaveBeenCalledWith('bookmarks')
    expect(mocks.resetSimpleSearchState).toHaveBeenCalledWith('bookmarks')
    expect(mocks.resetUniqueFoldersCache).toHaveBeenCalledTimes(1)
    expect(mocks.browserApi.bookmarks.update).toHaveBeenCalledWith(BOOKMARK_ID, {
      title: 'Updated Title #alpha #beta',
      url: 'http://updated.com',
    })
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
    document.getElementById('bm-favorite').dataset.favorite = 'yellow'

    module.updateBookmark(BOOKMARK_ID)

    expect(mocks.browserApi.bookmarks.update).toHaveBeenCalledWith(BOOKMARK_ID, {
      title: 'Updated Title +25 #star',
      url: 'http://updated.com',
    })
    expect(bookmark.customBonusScore).toBe(25)
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
    document.getElementById('bm-favorite').dataset.favorite = ''

    module.updateBookmark(BOOKMARK_ID)

    expect(mocks.browserApi.bookmarks.update).toHaveBeenCalledWith(BOOKMARK_ID, {
      title: 'Updated Title',
      url: 'http://updated.com',
    })
    expect(bookmark.customBonusScore).toBe(0)
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
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    document.getElementById('bm-title').value = 'Updated Title'
    document.getElementById('bm-url').value = 'http://updated.com'
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

    expect(mocks.browserApi.bookmarks.remove).toHaveBeenCalledWith(BOOKMARK_ID)
    expect(global.ext.model.bookmarks).toEqual([
      {
        originalId: 'bookmark-2',
        title: 'Bookmark 2',
        tags: '',
        folder: '~Play',
      },
    ])
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

    expect(mocks.searchMock).not.toHaveBeenCalled()
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

  describe('getStarState', () => {
    it('returns "yellow" for customBonusScore 1 through 25', async () => {
      const { module } = await loadEditBookmarkView()
      expect(module.getStarState(1)).toBe('yellow')
      expect(module.getStarState(10)).toBe('yellow')
      expect(module.getStarState(25)).toBe('yellow')
    })

    it('returns "orange" for customBonusScore 26 through 50', async () => {
      const { module } = await loadEditBookmarkView()
      expect(module.getStarState(26)).toBe('orange')
      expect(module.getStarState(50)).toBe('orange')
    })

    it('returns "red" for customBonusScore 51 and above', async () => {
      const { module } = await loadEditBookmarkView()
      expect(module.getStarState(51)).toBe('red')
      expect(module.getStarState(75)).toBe('red')
      expect(module.getStarState(100)).toBe('red')
    })

    it('returns "" for customBonusScore 0', async () => {
      const { module } = await loadEditBookmarkView()
      expect(module.getStarState(0)).toBe('')
    })
  })

  describe('updateFavoriteButton', () => {
    it('sets data-favorite and aria-pressed attributes', async () => {
      setupDom()
      setupExt([])
      const { module } = await loadEditBookmarkView()
      const button = document.getElementById('bm-favorite')

      module.updateFavoriteButton(button, 'yellow')
      expect(button.dataset.favorite).toBe('yellow')
      expect(button.getAttribute('aria-pressed')).toBe('true')

      module.updateFavoriteButton(button, '')
      expect(button.dataset.favorite).toBe('')
      expect(button.getAttribute('aria-pressed')).toBe('false')

      module.updateFavoriteButton(button, 'orange')
      expect(button.dataset.favorite).toBe('orange')
      expect(button.getAttribute('aria-pressed')).toBe('true')
    })

    it('updates label text based on state', async () => {
      setupDom()
      setupExt([])
      const { module } = await loadEditBookmarkView()
      const button = document.getElementById('bm-favorite')
      const label = button.querySelector('.favorite-label')

      module.updateFavoriteButton(button, 'yellow')
      expect(label.textContent).toBe('★ (+25)')

      module.updateFavoriteButton(button, 'yellow', 15)
      expect(label.textContent).toBe('★ (+15)')

      module.updateFavoriteButton(button, 'orange')
      expect(label.textContent).toBe('★★ (+50)')

      module.updateFavoriteButton(button, 'orange', 30)
      expect(label.textContent).toBe('★★ (+30)')

      module.updateFavoriteButton(button, 'red')
      expect(label.textContent).toBe('★★★ (+75)')

      module.updateFavoriteButton(button, '')
      expect(label.textContent).toBe('FAVORITE')
    })

    it('does nothing if button is null', async () => {
      const { module } = await loadEditBookmarkView()
      expect(() => module.updateFavoriteButton(null, 'yellow')).not.toThrow()
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
      expect(button.dataset.favorite).toBe('yellow')
    })

    it('cycles from yellow to orange', async () => {
      setupDom()
      setupExt([])
      const { module } = await loadEditBookmarkView()
      const button = document.getElementById('bm-favorite')
      button.dataset.favorite = 'yellow'

      module.cycleFavoriteButton(button)
      expect(button.dataset.favorite).toBe('orange')
    })

    it('cycles from orange to red', async () => {
      setupDom()
      setupExt([])
      const { module } = await loadEditBookmarkView()
      const button = document.getElementById('bm-favorite')
      button.dataset.favorite = 'orange'

      module.cycleFavoriteButton(button)
      expect(button.dataset.favorite).toBe('red')
    })

    it('cycles from red back to empty', async () => {
      setupDom()
      setupExt([])
      const { module } = await loadEditBookmarkView()
      const button = document.getElementById('bm-favorite')
      button.dataset.favorite = 'red'

      module.cycleFavoriteButton(button)
      expect(button.dataset.favorite).toBe('')
    })

    it('does nothing if button is null', async () => {
      const { module } = await loadEditBookmarkView()
      expect(() => module.cycleFavoriteButton(null)).not.toThrow()
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
      expect(favoriteButton.dataset.favorite).toBe('yellow')
      expect(favoriteButton.getAttribute('aria-pressed')).toBe('true')
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
      expect(favoriteButton.dataset.favorite).toBe('orange')
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
      expect(favoriteButton.dataset.favorite).toBe('red')
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
      expect(favoriteButton.dataset.favorite).toBe('')
      expect(favoriteButton.querySelector('.favorite-label').textContent).toBe('FAVORITE')
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
      expect(favoriteButton.dataset.favorite).toBe('yellow')
      expect(favoriteButton.querySelector('.favorite-label').textContent).toBe('★ (+20)')
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
      expect(favoriteButton.dataset.favorite).toBe('orange')
      expect(favoriteButton.querySelector('.favorite-label').textContent).toBe('★★ (+35)')
    })
  })
})
