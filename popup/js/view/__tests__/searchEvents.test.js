import '../../../../test/setup.js'
import assert from 'node:assert/strict'
import { afterEach, describe, it, mock } from 'node:test'
import { resetModules } from '../../../../test/modules.js'
import { matches } from '../../../../test/patterns.js'

/**
 * ✅ Covered behaviors: result opening flows (close, copy, modifiers, tab switching),
 *   and search approach toggling.
 * ⚠️ Known gaps: does not verify browser navigation side effects beyond mocked APIs.
 * 🐞 Added BUG tests: tab deletion with findIndex returning -1.
 */

const originalWindowClose = window.close
const originalWindowOpen = window.open
const originalClipboard = navigator.clipboard
function createResults() {
  return [
    {
      type: 'bookmark',
      originalId: 'bm-1',
      originalUrl: 'https://bookmark.test',
      url: 'bookmark.test',
      title: 'Bookmark Title',
      tagsArray: ['alpha', 'beta'],
      folderArray: ['Work', 'Docs'],
      lastVisitSecondsAgo: 3600,
      visitCount: 7,
      dateAdded: new Date('2023-01-02').getTime(),
      score: 41.8,
    },
    {
      type: 'tab',
      originalId: 2,
      originalUrl: 'https://tab.test',
      url: 'tab.test',
      title: 'Tab Title',
      score: 8.4,
    },
  ]
}
async function setupSearchEvents({ results = createResults(), bookmarks = [], opts = {} } = {}) {
  resetModules()
  window.location.hash = '#search/query'
  const getUserOptions = mock.fn(async () => ({ searchStrategy: 'precise' }))
  const setUserOptions = mock.fn(async () => {})
  const searchMock = mock.fn(() => Promise.resolve())
  const resetFuzzySearchState = mock.fn()
  const resetSimpleSearchState = mock.fn()
  mock.module(new URL('../../model/optionsStorage.js', import.meta.url), {
    exports: {
      getUserOptions,
      setUserOptions,
    },
  })
  mock.module(new URL('../../search/common.js', import.meta.url), {
    exports: {
      search: searchMock,
    },
  })
  mock.module(new URL('../../search/fuzzySearch.js', import.meta.url), {
    exports: {
      resetFuzzySearchState,
    },
  })
  mock.module(new URL('../../search/simpleSearch.js', import.meta.url), {
    exports: {
      resetSimpleSearchState,
    },
  })

  // Import modules needed for events
  const searchEventsModule = await import('../searchEvents.js')
  const searchViewModule = await import('../searchView.js')
  const searchNavigationModule = await import('../searchNavigation.js')
  document.body.innerHTML = `
    <input id="q" />
    <ul id="results"></ul>
    <button id="toggle"></button>
  `
  const resultList = document.getElementById('results')
  const searchInput = document.getElementById('q')
  const searchApproachToggle = document.getElementById('toggle')
  const copiedResults = results.map((entry) => ({ ...entry }))
  const tabEntries = copiedResults
    .filter((entry) => entry.type === 'tab')
    .map((entry) => ({
      originalId: entry.originalId,
      originalUrl: entry.originalUrl,
      url: entry.url,
      title: entry.title,
      active: entry.active,
      favIconUrl: entry.favIconUrl,
      group: entry.group,
      groupLower: entry.groupLower,
      groupId: entry.groupId,
      windowId: 101,
    }))
  const copiedBookmarks = bookmarks.map((entry) => ({ ...entry }))
  navigator.clipboard = {
    writeText: mock.fn(() => Promise.resolve()),
  }
  window.Mark = mock.fn(() => ({
    mark: mock.fn(),
  }))
  window.close = mock.fn()
  window.open = mock.fn()
  global.ext = {
    dom: {
      resultList,
      searchInput,
      searchApproachToggle,
    },
    model: {
      result: copiedResults,
      tabs: tabEntries,
      bookmarks: copiedBookmarks,
      searchTerm: 'query',
      mouseMoved: false,
      currentItem: 0,
    },
    opts: {
      displaySearchMatchHighlight: true,
      bookmarkColor: '#111',
      tabColor: '#222',
      displayTags: true,
      displayFolderName: true,
      displayLastVisit: true,
      displayVisitCounter: true,
      displayDateAdded: true,
      displayScore: true,
      searchStrategy: 'precise',
      ...opts,
    },
    browserApi: {
      tabs: {
        remove: mock.fn(),
        query: mock.fn(() => Promise.resolve([{ id: 77 }])),
        update: mock.fn(),
        create: mock.fn(),
        highlight: mock.fn(),
      },
      windows: {
        update: mock.fn(),
      },
    },
  }
  return {
    module: searchEventsModule,
    viewModule: searchViewModule,
    navigationModule: searchNavigationModule,
    mocks: {
      getUserOptions,
      setUserOptions,
      search: searchMock,
      resetFuzzySearchState,
      resetSimpleSearchState,
    },
    elements: {
      resultList,
      searchInput,
      searchApproachToggle,
    },
    results: copiedResults,
  }
}
afterEach(() => {
  delete global.ext
  delete window.Mark
  navigator.clipboard = originalClipboard
  window.close = originalWindowClose
  window.open = originalWindowOpen
  document.body.innerHTML = ''
  window.location.hash = ''
})
describe('searchEvents openResultItem', () => {
  it('builds the new-bookmark editor URL for quick bookmark results', async () => {
    const { module } = await setupSearchEvents()
    ext.model.searchTerm = ''
    const url = module.buildNewBookmarkEditorUrl({
      type: 'bookmarkCreate',
      pageTitle: 'Page Title',
      originalUrl: 'https://new.test/page?x=1#section',
    })
    assert.strictEqual(
      url,
      './editBookmark.html#new?url=https%3A%2F%2Fnew.test%2Fpage%3Fx%3D1%23section&title=Page+Title&return=%23search%2F',
    )
  })
  it('builds the bookmark editor URL for existing bookmark results', async () => {
    const { module } = await setupSearchEvents()
    ext.model.searchTerm = 'docs query'
    const url = module.buildEditBookmarkEditorUrl({
      type: 'bookmark',
      originalId: 'folder/bookmark 1',
    })
    assert.strictEqual(url, './editBookmark.html#bookmark/folder%2Fbookmark%201?return=%23search%2Fdocs+query')
  })
  it('opens the bookmark editor for the selected bookmark', async () => {
    const { module, viewModule } = await setupSearchEvents()
    await viewModule.renderSearchResults()
    const errorSpy = mock.method(console, 'error', () => {})
    const editorUrl = module.editSelectedResultAsBookmark()
    assert.strictEqual(editorUrl, './editBookmark.html#bookmark/bm-1?return=%23search%2Fquery')
    errorSpy.mock.restore()
  })
  it('opens a new bookmark draft for the selected tab', async () => {
    const { module, viewModule } = await setupSearchEvents()
    await viewModule.renderSearchResults()
    ext.model.currentItem = 1
    const errorSpy = mock.method(console, 'error', () => {})
    const editorUrl = module.editSelectedResultAsBookmark()
    assert.strictEqual(
      editorUrl,
      './editBookmark.html#new?url=https%3A%2F%2Ftab.test&title=Tab+Title&return=%23search%2Fquery',
    )
    errorSpy.mock.restore()
  })
  it('copies URL to clipboard on right click', async () => {
    const { module, viewModule } = await setupSearchEvents()
    await viewModule.renderSearchResults()
    const selected = document.getElementById('sel')
    module.openResultItem({
      button: 2,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      target: {
        nodeName: 'LI',
        getAttribute: () => null,
        className: '',
      },
      preventDefault: mock.fn(),
      stopPropagation: mock.fn(),
    })
    assert(
      navigator.clipboard.writeText.mock.calls.some((call) =>
        matches(call.arguments, [selected.getAttribute('x-open-url')]),
      ),
    )
  })
  it('closes tabs from the result list when the close button is pressed', async () => {
    const { viewModule, elements, mocks } = await setupSearchEvents()
    await viewModule.renderSearchResults()
    const tabItem = elements.resultList.children[1]
    const closeButton = tabItem.querySelector('.close')
    closeButton.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    assert(ext.browserApi.tabs.remove.mock.calls.some((call) => matches(call.arguments, [2])))
    assert.strictEqual(ext.model.tabs.length, 0)
    assert.strictEqual(ext.model.result.length, 1)
    assert.strictEqual(elements.resultList.children.length, 1)
    assert(mocks.resetSimpleSearchState.mock.calls.some((call) => matches(call.arguments, ['tabs'])))
    assert(mocks.resetFuzzySearchState.mock.calls.some((call) => matches(call.arguments, ['tabs'])))
  })
  it('clears open-tab metadata from matching bookmarks when a tab is closed', async () => {
    const results = createResults()
    results[1].active = true
    results[1].favIconUrl = 'https://tab.test/favicon.png'
    results[1].group = 'Work'
    results[1].groupLower = 'work'
    results[1].groupId = 7
    const bookmarks = [
      {
        type: 'bookmark',
        originalId: 'bm-open',
        originalUrl: 'https://tab.test',
        url: 'tab.test',
        title: 'Bookmarked Tab',
        tab: true,
        openTabTitle: 'Tab Title',
        openTabActive: true,
        favIconUrl: 'https://tab.test/favicon.png',
        group: 'Work',
        groupLower: 'work',
        groupId: 7,
      },
      {
        type: 'bookmark',
        originalId: 'bm-other',
        originalUrl: 'https://other.test',
        url: 'other.test',
        title: 'Other Bookmark',
        tab: true,
        openTabTitle: 'Other Tab',
      },
    ]
    const { viewModule, elements } = await setupSearchEvents({ results, bookmarks })
    await viewModule.renderSearchResults()
    elements.resultList.children[1].querySelector('.close').dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    assert.partialDeepStrictEqual(ext.model.bookmarks[0], {
      type: 'bookmark',
      originalId: 'bm-open',
      originalUrl: 'https://tab.test',
      url: 'tab.test',
      title: 'Bookmarked Tab',
    })
    assert.strictEqual(ext.model.bookmarks[0].tab, undefined)
    assert.strictEqual(ext.model.bookmarks[0].openTabTitle, undefined)
    assert.strictEqual(ext.model.bookmarks[0].openTabActive, undefined)
    assert.strictEqual(ext.model.bookmarks[0].favIconUrl, undefined)
    assert.strictEqual(ext.model.bookmarks[0].group, undefined)
    assert.strictEqual(ext.model.bookmarks[0].groupLower, undefined)
    assert.strictEqual(ext.model.bookmarks[0].groupId, undefined)
    assert.strictEqual(ext.model.bookmarks[1].tab, true)
    assert.strictEqual(ext.model.bookmarks[1].openTabTitle, 'Other Tab')
  })

  for (const [first, last] of [
    [2, 3],
    [3, 2],
  ]) {
    it(`refreshes visible bookmark metadata when closing hash tabs ${first} then ${last}`, async () => {
      const tabs = [
        {
          type: 'tab',
          originalId: 2,
          originalUrl: 'https://app.test/#/inbox',
          url: 'app.test',
          title: 'Inbox',
          active: true,
          favIconUrl: 'https://app.test/inbox.png',
          group: 'Work',
          groupLower: 'work',
          groupId: 7,
          score: 8.4,
        },
        {
          type: 'tab',
          originalId: 3,
          originalUrl: 'https://app.test/#/settings',
          url: 'app.test',
          title: 'Settings',
          active: false,
          favIconUrl: 'https://app.test/settings.png',
          group: 'Personal',
          groupLower: 'personal',
          groupId: 8,
          score: 8.0,
        },
      ]
      const bookmark = {
        ...tabs[0],
        type: 'bookmark',
        originalId: 'bm-app',
        originalUrl: 'https://app.test/',
        title: 'App',
        tab: true,
        openTabTitle: 'Inbox',
        openTabActive: true,
        highlightedGroup: '@<mark>Work</mark>',
      }
      const { viewModule, elements } = await setupSearchEvents({
        results: [bookmark, ...tabs],
        bookmarks: [bookmark],
        opts: { displayTabGroup: true, displayFavicons: true },
      })
      await viewModule.renderSearchResults()

      elements.resultList
        .querySelector(`[x-original-id="${first}"] .close`)
        .dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))

      const remaining = tabs.find((tab) => tab.originalId === last)
      assert.strictEqual(ext.model.tabs.length, 1)
      for (const entry of [ext.model.bookmarks[0], ext.model.result[0]]) {
        assert.partialDeepStrictEqual(entry, {
          tab: true,
          openTabTitle: remaining.title,
          openTabActive: remaining.active,
          favIconUrl: remaining.favIconUrl,
          group: remaining.group,
          groupLower: remaining.groupLower,
          groupId: remaining.groupId,
        })
      }
      let visibleBookmark = elements.resultList.querySelector('.bookmark')
      assert.strictEqual(visibleBookmark.querySelector('[title="Tab Group"]').textContent, `@${remaining.group}`)
      assert.strictEqual(visibleBookmark.querySelector('.favicon').getAttribute('src'), remaining.favIconUrl)
      assert(visibleBookmark.style.backgroundImage.includes('linear-gradient'))

      elements.resultList
        .querySelector(`[x-original-id="${last}"] .close`)
        .dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))

      assert.strictEqual(ext.model.tabs.length, 0)
      for (const entry of [ext.model.bookmarks[0], ext.model.result[0]]) {
        for (const field of [
          'tab',
          'openTabTitle',
          'openTabActive',
          'favIconUrl',
          'group',
          'groupLower',
          'groupId',
          'highlightedGroup',
        ]) {
          assert.strictEqual(entry[field], undefined)
        }
      }
      visibleBookmark = elements.resultList.querySelector('.bookmark')
      assert.strictEqual(visibleBookmark.querySelector('[title="Tab Group"]'), null)
      assert.strictEqual(visibleBookmark.querySelector('.favicon'), null)
      assert.strictEqual(visibleBookmark.style.backgroundImage, '')
    })
  }

  it('ignores stale close buttons without a valid tab id', async () => {
    const { module } = await setupSearchEvents()
    module.openResultItem({
      button: 0,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      target: {
        nodeName: 'BUTTON',
        className: 'close',
        parentElement: null,
        getAttribute: () => null,
      },
      stopPropagation: mock.fn(),
      preventDefault: mock.fn(),
    })
    assert(ext.browserApi.tabs.remove.mock.callCount() === 0)
    assert.strictEqual(ext.model.tabs.length, 1)
    assert.strictEqual(ext.model.result.length, 2)
  })
  it('does not delete wrong tab when originalId is not found in model (BUG: findIndex returns -1)', async () => {
    // Set up multiple tabs and results to verify wrong deletion doesn't occur
    const multipleResults = [
      {
        type: 'tab',
        originalId: 100,
        originalUrl: 'https://tab1.test',
        url: 'tab1.test',
        title: 'Tab 1',
        score: 10,
      },
      {
        type: 'tab',
        originalId: 200,
        originalUrl: 'https://tab2.test',
        url: 'tab2.test',
        title: 'Tab 2',
        score: 9,
      },
      {
        type: 'tab',
        originalId: 300,
        originalUrl: 'https://tab3.test',
        url: 'tab3.test',
        title: 'Tab 3',
        score: 8,
      },
    ]
    const { module, viewModule } = await setupSearchEvents({
      results: multipleResults,
    })
    await viewModule.renderSearchResults()

    // Store initial state
    const initialTabsLength = ext.model.tabs.length
    const initialResultLength = ext.model.result.length
    const lastTab = { ...ext.model.tabs[ext.model.tabs.length - 1] }
    const lastResult = { ...ext.model.result[ext.model.result.length - 1] }

    // Mock the selected result to have a non-existent ID
    const selectedResult = document.getElementById('sel')
    selectedResult.setAttribute('x-original-id', '999')

    // Try to close a tab with an ID that doesn't exist in the model
    // This simulates a race condition or stale UI state
    module.openResultItem({
      button: 0,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      target: {
        nodeName: 'BUTTON',
        className: 'close',
        getAttribute: () => null,
      },
      stopPropagation: mock.fn(),
      preventDefault: mock.fn(),
    })

    // BEFORE FIX: splice(-1, 1) would delete the last element
    // AFTER FIX: arrays should remain unchanged
    assert.strictEqual(ext.model.tabs.length, initialTabsLength)
    assert.strictEqual(ext.model.result.length, initialResultLength)
    assert.deepStrictEqual(ext.model.tabs[ext.model.tabs.length - 1], lastTab)
    assert.deepStrictEqual(ext.model.result[ext.model.result.length - 1], lastResult)
  })
  it('parses tab IDs correctly with radix 10 when closing tabs', async () => {
    const results = [
      {
        type: 'tab',
        originalId: 8,
        originalUrl: 'https://tab1.test',
        url: 'tab1.test',
        title: 'Tab with ID 8',
        score: 10,
      },
      {
        type: 'tab',
        originalId: 10,
        originalUrl: 'https://tab2.test',
        url: 'tab2.test',
        title: 'Tab with ID 10',
        score: 9,
      },
      {
        type: 'tab',
        originalId: 100,
        originalUrl: 'https://tab3.test',
        url: 'tab3.test',
        title: 'Tab with ID 100',
        score: 8,
      },
    ]
    const { viewModule, elements } = await setupSearchEvents({ results })
    await viewModule.renderSearchResults()

    // Test closing tab with ID 8
    const firstTabCloseButton = elements.resultList.children[0].querySelector('.close')
    firstTabCloseButton.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    assert(ext.browserApi.tabs.remove.mock.calls.some((call) => matches(call.arguments, [8])))

    // Test closing tab with ID 10
    await viewModule.renderSearchResults()
    const secondTabCloseButton = elements.resultList.children[0].querySelector('.close')
    secondTabCloseButton.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    assert(ext.browserApi.tabs.remove.mock.calls.some((call) => matches(call.arguments, [10])))

    // Test closing tab with ID 100
    await viewModule.renderSearchResults()
    const thirdTabCloseButton = elements.resultList.children[0].querySelector('.close')
    thirdTabCloseButton.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    assert(ext.browserApi.tabs.remove.mock.calls.some((call) => matches(call.arguments, [100])))
  })
  it('opens URLs in the current tab when shift is held and closes the popup afterward', async () => {
    const { module, viewModule } = await setupSearchEvents()
    await viewModule.renderSearchResults()
    module.openResultItem({
      button: 0,
      shiftKey: true,
      altKey: false,
      ctrlKey: false,
      target: {
        nodeName: 'LI',
        getAttribute: () => null,
        className: '',
      },
      stopPropagation: mock.fn(),
      preventDefault: mock.fn(),
    })
    await Promise.resolve()
    assert.strictEqual(ext.browserApi.tabs.query.mock.callCount(), 1)
    assert(
      ext.browserApi.tabs.update.mock.calls.some((call) =>
        matches(call.arguments, [
          77,
          {
            url: 'https://bookmark.test',
          },
        ]),
      ),
    )
    assert.strictEqual(window.close.mock.callCount(), 1)
  })
  it('handles shift-click gracefully when no active tab is found', async () => {
    const { module, viewModule } = await setupSearchEvents()
    await viewModule.renderSearchResults()

    // Mock query to return empty array (no active tabs)
    ext.browserApi.tabs.query = mock.fn(() => Promise.resolve([]))
    module.openResultItem({
      button: 0,
      shiftKey: true,
      altKey: false,
      ctrlKey: false,
      target: {
        nodeName: 'LI',
        getAttribute: () => null,
        className: '',
      },
      stopPropagation: mock.fn(),
      preventDefault: mock.fn(),
    })
    await Promise.resolve()
    assert.strictEqual(ext.browserApi.tabs.query.mock.callCount(), 1)
    assert(ext.browserApi.tabs.update.mock.callCount() === 0)
    assert(window.close.mock.callCount() === 0)
  })
  it('opens URLs in a background tab when ctrl is held', async () => {
    const { module, viewModule } = await setupSearchEvents()
    await viewModule.renderSearchResults()
    module.openResultItem({
      button: 0,
      ctrlKey: true,
      shiftKey: false,
      altKey: false,
      target: {
        nodeName: 'LI',
        getAttribute: () => null,
        className: '',
      },
      stopPropagation: mock.fn(),
      preventDefault: mock.fn(),
    })
    assert(
      ext.browserApi.tabs.create.mock.calls.some((call) =>
        matches(call.arguments, [
          {
            active: false,
            url: 'https://bookmark.test',
          },
        ]),
      ),
    )
  })
  it('switches to an existing tab when a matching tab is found', async () => {
    const { module, viewModule, navigationModule } = await setupSearchEvents()
    await viewModule.renderSearchResults()
    // Select the tab item (index 1)
    navigationModule.selectListItem(1)
    module.openResultItem({
      button: 0,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      target: {
        nodeName: 'LI',
        getAttribute: () => null,
        className: '',
      },
      stopPropagation: mock.fn(),
      preventDefault: mock.fn(),
    })
    assert(ext.browserApi.tabs.update.mock.calls.some((call) => matches(call.arguments, [2, { active: true }])))
    assert(
      ext.browserApi.windows.update.mock.calls.some((call) =>
        matches(call.arguments, [
          101,
          {
            focused: true,
          },
        ]),
      ),
    )
    assert.strictEqual(window.close.mock.callCount(), 1)
  })
  it('prefers matching tabs by originalId before normalized URL', async () => {
    const tabResults = [
      {
        type: 'tab',
        originalId: 100,
        originalUrl: 'https://example.test/page#one',
        url: 'example.test/page',
        title: 'First tab',
        score: 10,
      },
      {
        type: 'tab',
        originalId: 200,
        originalUrl: 'https://example.test/page#two',
        url: 'example.test/page',
        title: 'Second tab',
        score: 9,
      },
    ]
    const { module, viewModule, navigationModule } = await setupSearchEvents({
      results: tabResults,
    })
    await viewModule.renderSearchResults()
    navigationModule.selectListItem(1)
    ext.model.tabs = [
      {
        originalId: 100,
        originalUrl: 'https://example.test/page#one',
        url: 'example.test/page',
        windowId: 101,
      },
      {
        originalId: 200,
        originalUrl: 'https://example.test/page#two',
        url: 'example.test/page',
        windowId: 202,
      },
    ]
    module.openResultItem({
      button: 0,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      target: {
        nodeName: 'LI',
        getAttribute: () => null,
        className: '',
      },
      stopPropagation: mock.fn(),
      preventDefault: mock.fn(),
    })
    assert(ext.browserApi.tabs.update.mock.calls.some((call) => matches(call.arguments, [200, { active: true }])))
    assert(
      ext.browserApi.windows.update.mock.calls.some((call) =>
        matches(call.arguments, [
          202,
          {
            focused: true,
          },
        ]),
      ),
    )
    assert(ext.browserApi.tabs.create.mock.callCount() === 0)
  })
  it('opens a new tab for a different hash by default (hash-aware matching)', async () => {
    const { module, viewModule } = await setupSearchEvents({
      results: [
        {
          type: 'bookmark',
          originalId: 'bm-1',
          originalUrl: 'https://app.test/site#Paystubs-Display',
          url: 'app.test/site',
          title: 'Paystubs',
          score: 10,
        },
      ],
    })
    await viewModule.renderSearchResults()

    // A tab on the same base URL but a different hash route is already open.
    ext.model.tabs = [
      {
        originalId: 42,
        originalUrl: 'https://app.test/site#leaverequest-create',
        url: 'app.test/site',
        windowId: 101,
      },
    ]
    module.openResultItem({
      button: 0,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      target: {
        nodeName: 'LI',
        getAttribute: () => null,
        className: '',
      },
      stopPropagation: mock.fn(),
      preventDefault: mock.fn(),
    })

    // Must NOT switch to the existing tab; must open a new one instead.
    assert(ext.browserApi.tabs.update.mock.callCount() === 0)
    assert(
      ext.browserApi.tabs.create.mock.calls.some((call) =>
        matches(call.arguments, [
          {
            active: true,
            url: 'https://app.test/site#Paystubs-Display',
          },
        ]),
      ),
    )
  })
  it('switches to an existing tab when the full URL including hash matches (default)', async () => {
    const { module, viewModule } = await setupSearchEvents({
      results: [
        {
          type: 'bookmark',
          originalId: 'bm-1',
          originalUrl: 'https://app.test/site#Paystubs-Display',
          url: 'app.test/site',
          title: 'Paystubs',
          score: 10,
        },
      ],
    })
    await viewModule.renderSearchResults()
    ext.model.tabs = [
      {
        originalId: 42,
        originalUrl: 'https://app.test/site#Paystubs-Display',
        url: 'app.test/site',
        windowId: 101,
      },
    ]
    module.openResultItem({
      button: 0,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      target: {
        nodeName: 'LI',
        getAttribute: () => null,
        className: '',
      },
      stopPropagation: mock.fn(),
      preventDefault: mock.fn(),
    })
    assert(ext.browserApi.tabs.update.mock.calls.some((call) => matches(call.arguments, [42, { active: true }])))
    assert(ext.browserApi.tabs.create.mock.callCount() === 0)
  })
  it('matches an existing tab by normalized URL when hashes match by default', async () => {
    const { module, viewModule } = await setupSearchEvents({
      results: [
        {
          type: 'bookmark',
          originalId: 'bm-1',
          originalUrl: 'https://bookmark.test/',
          url: 'bookmark.test',
          title: 'Bookmark Title',
          score: 10,
        },
      ],
    })
    await viewModule.renderSearchResults()
    ext.model.tabs = [
      {
        originalId: 22,
        originalUrl: 'https://bookmark.test',
        url: 'bookmark.test',
        windowId: 101,
      },
    ]
    module.openResultItem({
      button: 0,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      target: {
        nodeName: 'LI',
        getAttribute: () => null,
        className: '',
      },
      stopPropagation: mock.fn(),
      preventDefault: mock.fn(),
    })
    assert(ext.browserApi.tabs.update.mock.calls.some((call) => matches(call.arguments, [22, { active: true }])))
    assert(ext.browserApi.tabs.create.mock.callCount() === 0)
  })
  it('matches an existing tab by normalized base URL when non-empty hashes match by default', async () => {
    const { module, viewModule } = await setupSearchEvents({
      results: [
        {
          type: 'bookmark',
          originalId: 'bm-1',
          originalUrl: 'https://app.test/site/#Paystubs-Display',
          url: 'app.test/site',
          title: 'Paystubs',
          score: 10,
        },
      ],
    })
    await viewModule.renderSearchResults()
    ext.model.tabs = [
      {
        originalId: 42,
        originalUrl: 'https://app.test/site#Paystubs-Display',
        url: 'app.test/site',
        windowId: 101,
      },
    ]
    module.openResultItem({
      button: 0,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      target: {
        nodeName: 'LI',
        getAttribute: () => null,
        className: '',
      },
      stopPropagation: mock.fn(),
      preventDefault: mock.fn(),
    })
    assert(ext.browserApi.tabs.update.mock.calls.some((call) => matches(call.arguments, [42, { active: true }])))
    assert(ext.browserApi.tabs.create.mock.callCount() === 0)
  })
  it('matches existing tabs by normalized URL when openTabMatchIgnoreHash is true', async () => {
    const { module, viewModule } = await setupSearchEvents({
      opts: { openTabMatchIgnoreHash: true },
      results: [
        {
          type: 'bookmark',
          originalId: 'bm-1',
          originalUrl: 'https://bookmark.test/',
          url: 'bookmark.test',
          title: 'Bookmark Title',
          score: 10,
        },
      ],
    })
    await viewModule.renderSearchResults()
    ext.model.tabs = [
      {
        originalId: 22,
        originalUrl: 'https://bookmark.test',
        url: 'bookmark.test',
        windowId: 101,
      },
    ]
    module.openResultItem({
      button: 0,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      target: {
        nodeName: 'LI',
        getAttribute: () => null,
        className: '',
      },
      stopPropagation: mock.fn(),
      preventDefault: mock.fn(),
    })
    assert(ext.browserApi.tabs.update.mock.calls.some((call) => matches(call.arguments, [22, { active: true }])))
    assert(ext.browserApi.tabs.create.mock.callCount() === 0)
  })
  it('activates an existing tab despite different hashes when openTabMatchIgnoreHash is true', async () => {
    const { module, viewModule } = await setupSearchEvents({
      opts: { openTabMatchIgnoreHash: true },
      results: [
        {
          type: 'bookmark',
          originalId: 'bm-1',
          originalUrl: 'https://app.test/site#Paystubs-Display',
          url: 'app.test/site',
          title: 'Paystubs',
          score: 10,
        },
      ],
    })
    await viewModule.renderSearchResults()
    ext.model.tabs = [
      {
        originalId: 42,
        originalUrl: 'https://app.test/site#leaverequest-create',
        url: 'app.test/site',
        windowId: 101,
      },
    ]
    module.openResultItem({
      button: 0,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      target: {
        nodeName: 'LI',
        getAttribute: () => null,
        className: '',
      },
      stopPropagation: mock.fn(),
      preventDefault: mock.fn(),
    })
    assert(ext.browserApi.tabs.update.mock.calls.some((call) => matches(call.arguments, [42, { active: true }])))
    assert(ext.browserApi.tabs.create.mock.callCount() === 0)
  })
  it('opens a new active tab when no matching tab exists', async () => {
    const { module, viewModule } = await setupSearchEvents()
    await viewModule.renderSearchResults()
    ext.model.tabs = []
    module.openResultItem({
      button: 0,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      target: {
        nodeName: 'LI',
        getAttribute: () => null,
        className: '',
      },
      stopPropagation: mock.fn(),
      preventDefault: mock.fn(),
    })
    assert(
      ext.browserApi.tabs.create.mock.calls.some((call) =>
        matches(call.arguments, [
          {
            active: true,
            url: 'https://bookmark.test',
          },
        ]),
      ),
    )
    assert.strictEqual(window.close.mock.callCount(), 1)
  })
  it('falls back to window.open when no browser tab APIs are available', async () => {
    const { module, viewModule } = await setupSearchEvents()
    await viewModule.renderSearchResults()
    delete ext.browserApi.tabs
    module.openResultItem({
      button: 0,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      target: {
        nodeName: 'LI',
        getAttribute: () => null,
        className: '',
      },
      stopPropagation: mock.fn(),
      preventDefault: mock.fn(),
    })
    assert(window.open.mock.calls.some((call) => matches(call.arguments, ['https://bookmark.test', '_newtab'])))
  })
  it('opens in the current tab on a plain click when openInCurrentTab is enabled', async () => {
    const { module, viewModule } = await setupSearchEvents({ opts: { openInCurrentTab: true } })
    await viewModule.renderSearchResults()
    ext.model.tabs = []
    module.openResultItem({
      button: 0,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      target: {
        nodeName: 'LI',
        getAttribute: () => null,
        className: '',
      },
      stopPropagation: mock.fn(),
      preventDefault: mock.fn(),
    })
    await Promise.resolve()
    assert.strictEqual(ext.browserApi.tabs.query.mock.callCount(), 1)
    assert(
      ext.browserApi.tabs.update.mock.calls.some((call) =>
        matches(call.arguments, [
          77,
          {
            url: 'https://bookmark.test',
          },
        ]),
      ),
    )
    assert(ext.browserApi.tabs.create.mock.callCount() === 0)
    assert.strictEqual(window.close.mock.callCount(), 1)
  })
  it('opens in a new tab when Shift is held and openInCurrentTab is enabled', async () => {
    const { module, viewModule } = await setupSearchEvents({ opts: { openInCurrentTab: true } })
    await viewModule.renderSearchResults()
    ext.model.tabs = []
    module.openResultItem({
      button: 0,
      ctrlKey: false,
      shiftKey: true,
      altKey: false,
      target: {
        nodeName: 'LI',
        getAttribute: () => null,
        className: '',
      },
      stopPropagation: mock.fn(),
      preventDefault: mock.fn(),
    })
    await Promise.resolve()
    assert(
      ext.browserApi.tabs.create.mock.calls.some((call) =>
        matches(call.arguments, [
          {
            active: true,
            url: 'https://bookmark.test',
          },
        ]),
      ),
    )
    assert(ext.browserApi.tabs.update.mock.callCount() === 0)
    assert.strictEqual(window.close.mock.callCount(), 1)
  })
  it('opens in a background tab when Ctrl is held even if openInCurrentTab is enabled', async () => {
    const { module, viewModule } = await setupSearchEvents({ opts: { openInCurrentTab: true } })
    await viewModule.renderSearchResults()
    ext.model.tabs = []
    module.openResultItem({
      button: 0,
      ctrlKey: true,
      shiftKey: false,
      altKey: false,
      target: {
        nodeName: 'LI',
        getAttribute: () => null,
        className: '',
      },
      stopPropagation: mock.fn(),
      preventDefault: mock.fn(),
    })
    await Promise.resolve()
    assert(
      ext.browserApi.tabs.create.mock.calls.some((call) =>
        matches(call.arguments, [
          {
            active: false,
            url: 'https://bookmark.test',
          },
        ]),
      ),
    )
    assert(ext.browserApi.tabs.update.mock.callCount() === 0)
    assert(ext.browserApi.tabs.query.mock.callCount() === 0)
    assert(window.close.mock.callCount() === 0)
  })
  it('reads result data from model state instead of stale DOM attributes (BUG: race condition fix)', async () => {
    const { module, viewModule } = await setupSearchEvents()
    await viewModule.renderSearchResults()

    // Simulate a race condition: DOM shows old results, but model has new results
    // This happens when Enter is pressed before search completes and re-renders
    const newResult = {
      type: 'bookmark',
      originalId: 'new-bm-123',
      originalUrl: 'https://correct-new-result.test',
      url: 'correct-new-result.test',
      title: 'Correct New Result',
      score: 999,
    }

    // Update model with new result (simulating completed search)
    ext.model.result = [newResult]
    ext.model.currentItem = 0

    // DOM still shows old result (hasn't re-rendered yet)
    const staleSelectedElement = document.getElementById('sel')
    assert.strictEqual(staleSelectedElement.getAttribute('x-open-url'), 'https://bookmark.test') // Old result

    // Call openResultItem - it should use model state, not DOM
    module.openResultItem({
      button: 0,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      target: {
        nodeName: 'LI',
        getAttribute: () => null,
        className: '',
      },
      stopPropagation: mock.fn(),
      preventDefault: mock.fn(),
    })

    // Verify it opened the NEW result from the model, not the old one from DOM
    assert(
      ext.browserApi.tabs.create.mock.calls.some((call) =>
        matches(call.arguments, [
          {
            active: true,
            url: 'https://correct-new-result.test', // New result, not old!
          },
        ]),
      ),
    )
  })
})
describe('search approach controls', () => {
  it('toggles between precise and fuzzy search strategies', async () => {
    const { module, mocks, elements } = await setupSearchEvents()
    ext.opts.searchStrategy = 'precise'
    await module.toggleSearchApproach()
    assert.strictEqual(ext.opts.searchStrategy, 'fuzzy')
    assert.strictEqual(mocks.getUserOptions.mock.callCount(), 1)
    assert(
      mocks.setUserOptions.mock.calls.some((call) =>
        matches(call.arguments, [
          {
            searchStrategy: 'fuzzy',
          },
        ]),
      ),
    )
    assert.strictEqual(elements.searchApproachToggle.innerText, 'FUZZY')
    assert.strictEqual(elements.searchApproachToggle.className, 'fuzzy')
    assert.strictEqual(mocks.search.mock.callCount(), 1)
  })
  it('updateSearchApproachToggle reflects current strategy', async () => {
    const { module, elements } = await setupSearchEvents()
    ext.opts.searchStrategy = 'precise'
    module.updateSearchApproachToggle()
    assert.strictEqual(elements.searchApproachToggle.innerText, 'PRECISE')
    assert.strictEqual(elements.searchApproachToggle.className, 'precise')
    ext.opts.searchStrategy = 'fuzzy'
    module.updateSearchApproachToggle()
    assert.strictEqual(elements.searchApproachToggle.innerText, 'FUZZY')
    assert.strictEqual(elements.searchApproachToggle.className, 'fuzzy')
  })
})
