import '../../../../test/setup.js'
import assert from 'node:assert/strict'
import { afterEach, describe, it, mock } from 'node:test'
import { format } from 'node:util'
import { resetModules } from '../../../../test/modules.js'
import { matches } from '../../../../test/patterns.js'

/**
 * ✅ Covered behaviors: keyboard navigation (arrow keys, vim-style, Enter, Escape),
 *   selection management, scrolling, and hover handling.
 * ⚠️ Known gaps: does not verify browser navigation side effects beyond mocked APIs.
 * 🐞 Added BUG tests: none.
 */

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
async function setupSearchNavigation({ results = createResults(), opts = {} } = {}) {
  resetModules()
  window.location.hash = '#search/query'

  // Import modules - no mocking needed
  const searchNavigationModule = await import('../searchNavigation.js')
  const searchViewModule = await import('../searchView.js')
  const searchEventsModule = await import('../searchEvents.js')
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
      windowId: 101,
    }))
  window.Mark = mock.fn(() => ({
    mark: mock.fn(),
  }))
  global.ext = {
    dom: {
      resultList,
      searchInput,
      searchApproachToggle,
    },
    model: {
      result: copiedResults,
      tabs: tabEntries,
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
    module: searchNavigationModule,
    viewModule: searchViewModule,
    eventsModule: searchEventsModule,
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
  document.body.innerHTML = ''
  window.location.hash = ''
})
describe('searchNavigation selection helpers', () => {
  it('selectListItem updates selection and scrolls when requested', async () => {
    const { module, viewModule, elements } = await setupSearchNavigation()
    await viewModule.renderSearchResults()
    const secondItem = elements.resultList.children[1]
    secondItem.scrollIntoView = mock.fn()
    module.selectListItem(1, true)
    assert.strictEqual(ext.model.currentItem, 1)
    assert.strictEqual(document.getElementById('sel'), secondItem)
    assert(
      secondItem.scrollIntoView.mock.calls.some((call) =>
        matches(call.arguments, [
          {
            behavior: 'auto',
            block: 'nearest',
          },
        ]),
      ),
    )
  })
  it('hoverResultItem only selects after mouse has actually moved', async () => {
    const { module, viewModule, elements } = await setupSearchNavigation()
    await viewModule.renderSearchResults()
    const firstItem = elements.resultList.children[0]
    const secondItem = elements.resultList.children[1]

    // Initially, mouseMoved is false (set by renderSearchResults)
    assert.strictEqual(ext.model.mouseMoved, false)

    // Hovering should not change selection when mouse hasn't moved
    module.hoverResultItem({ target: secondItem })
    assert.strictEqual(ext.model.currentItem, 0)
    assert.strictEqual(document.getElementById('sel'), firstItem)

    // Simulate actual mouse movement
    ext.model.mouseMoved = true

    // Now hovering should update selection
    module.hoverResultItem({ target: secondItem })
    assert.strictEqual(ext.model.currentItem, '1')
    assert.strictEqual(document.getElementById('sel'), secondItem)
  })
})
describe('searchNavigation navigationKeyListener', () => {
  const imeCases = [
    {
      name: 'isComposing is active',
      event: { isComposing: true },
    },
    {
      name: 'legacy Process key fallback is reported',
      event: { isComposing: false, keyCode: 229, which: 229 },
    },
  ]
  it('handles arrow navigation and prevents going above first item', async () => {
    const { module, viewModule, elements } = await setupSearchNavigation()
    await viewModule.renderSearchResults()
    const preventDefault = mock.fn()
    Array.from(elements.resultList.children).forEach((child) => {
      child.scrollIntoView = mock.fn()
    })
    elements.searchInput.value = 'typed'
    module.navigationKeyListener({
      key: 'ArrowUp',
      ctrlKey: false,
      preventDefault,
    })
    assert.strictEqual(preventDefault.mock.callCount(), 1)
    assert.strictEqual(ext.model.currentItem, 0)
    preventDefault.mock.resetCalls()
    module.navigationKeyListener({
      key: 'ArrowDown',
      ctrlKey: false,
      preventDefault,
    })
    assert.strictEqual(preventDefault.mock.callCount(), 1)
    assert.strictEqual(ext.model.currentItem, 1)
    assert.strictEqual(document.getElementById('sel'), elements.resultList.children[1])
  })
  it('supports vim-style navigation keybindings', async () => {
    const { module, viewModule, elements } = await setupSearchNavigation()
    await viewModule.renderSearchResults()
    const preventDefault = mock.fn()
    Array.from(elements.resultList.children).forEach((child) => {
      child.scrollIntoView = mock.fn()
    })

    // Test all vim-style down keybindings
    const downKeys = [
      { key: 'n', ctrlKey: true },
      { key: 'j', ctrlKey: true },
    ]
    for (const keyCombo of downKeys) {
      ext.model.currentItem = 0
      module.navigationKeyListener({ ...keyCombo, preventDefault })
      assert.strictEqual(ext.model.currentItem, 1)
    }

    // Test all vim-style up keybindings
    const upKeys = [
      { key: 'p', ctrlKey: true },
      { key: 'k', ctrlKey: true },
    ]
    for (const keyCombo of upKeys) {
      ext.model.currentItem = 1
      module.navigationKeyListener({ ...keyCombo, preventDefault })
      assert.strictEqual(ext.model.currentItem, 0)
    }
  })
  it('handles Enter key by calling openResultItem', async () => {
    const { module, viewModule } = await setupSearchNavigation()
    await viewModule.renderSearchResults()

    // Mock window.close to verify openResultItem was called (it closes the window)
    const windowCloseSpy = mock.fn()
    window.close = windowCloseSpy
    const event = {
      key: 'Enter',
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      preventDefault: mock.fn(),
      stopPropagation: mock.fn(),
      button: 0,
      target: {
        nodeName: 'LI',
        getAttribute: () => null,
        className: '',
      },
    }
    window.location.hash = '#search/query'
    await module.navigationKeyListener(event)

    // Verify window closed (side effect of openResultItem for bookmark)
    assert.strictEqual(windowCloseSpy.mock.callCount(), 1)
  })
  ;[{ strategy: 'precise' }, { strategy: 'fuzzy' }].forEach((testCase) => {
    const args = Array.isArray(testCase) ? testCase : [testCase]
    it(
      format(
        'ignores Enter while IME composition is active in $strategy mode'.replace(
          /\$([a-zA-Z]+)/g,
          (_, key) => testCase[key],
        ),
        ...args,
      ),
      () =>
        (async ({ strategy }) => {
          for (const imeCase of imeCases) {
            const { module, viewModule } = await setupSearchNavigation({
              opts: { searchStrategy: strategy },
            })
            await viewModule.renderSearchResults()
            const windowCloseSpy = mock.fn()
            window.close = windowCloseSpy
            await module.navigationKeyListener({
              key: 'Enter',
              preventDefault: mock.fn(),
              stopPropagation: mock.fn(),
              button: 0,
              target: {
                nodeName: 'LI',
                getAttribute: () => null,
                className: '',
              },
              ...imeCase.event,
            })
            assert(windowCloseSpy.mock.callCount() === 0)
            assert.strictEqual(ext.model.currentItem, 0)
          }
        })(...args),
    )
  })
  ;[{ strategy: 'precise' }, { strategy: 'fuzzy' }].forEach((testCase) => {
    const args = Array.isArray(testCase) ? testCase : [testCase]
    it(
      format(
        'ignores navigation keys while IME composition is active in $strategy mode'.replace(
          /\$([a-zA-Z]+)/g,
          (_, key) => testCase[key],
        ),
        ...args,
      ),
      () =>
        (async ({ strategy }) => {
          for (const imeCase of imeCases) {
            const { module, viewModule, elements } = await setupSearchNavigation({
              opts: { searchStrategy: strategy },
            })
            await viewModule.renderSearchResults()
            const preventDefault = mock.fn()
            Array.from(elements.resultList.children).forEach((child) => {
              child.scrollIntoView = mock.fn()
            })
            ext.model.currentItem = 0
            await module.navigationKeyListener({
              key: 'ArrowDown',
              preventDefault,
              ...imeCase.event,
            })
            assert(preventDefault.mock.callCount() === 0)
            assert.strictEqual(ext.model.currentItem, 0)
            assert.strictEqual(document.getElementById('sel'), elements.resultList.children[0])
          }
        })(...args),
    )
  })
  it('waits for in-flight search to complete before opening result on Enter', async () => {
    const { module, viewModule } = await setupSearchNavigation()
    await viewModule.renderSearchResults()

    // Mock window.close to verify openResultItem was called
    const windowCloseSpy = mock.fn()
    window.close = windowCloseSpy

    // Simulate an in-flight search by creating a pending promise
    let resolveSearch
    const searchPromise = new Promise((resolve) => {
      resolveSearch = resolve
    })
    ext.model.activeSearchPromise = searchPromise

    // Update the model with new results that will be available after search completes
    const newResults = [
      {
        type: 'bookmark',
        originalId: 'new-bm',
        originalUrl: 'https://new-result.test',
        url: 'new-result.test',
        title: 'New Search Result',
        score: 100,
      },
    ]
    const event = {
      key: 'Enter',
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      preventDefault: mock.fn(),
      stopPropagation: mock.fn(),
      button: 0,
      target: {
        nodeName: 'LI',
        getAttribute: () => null,
        className: '',
      },
    }
    window.location.hash = '#search/query'

    // Start the navigation (it should wait for the search to complete)
    const navigationPromise = module.navigationKeyListener(event)

    // Verify that window.close hasn't been called yet (still waiting for search)
    assert(windowCloseSpy.mock.callCount() === 0)

    // Now complete the search and update results
    ext.model.result = newResults
    ext.model.currentItem = 0
    resolveSearch()

    // Wait for navigation to complete
    await navigationPromise

    // Now verify window closed (openResultItem was called with the correct result)
    assert.strictEqual(windowCloseSpy.mock.callCount(), 1)
  })
  it('handles Escape key to reset search and focus input', async () => {
    const { module, viewModule, elements } = await setupSearchNavigation()
    await viewModule.renderSearchResults()
    const focusMock = mock.fn()
    elements.searchInput.focus = focusMock
    window.location.hash = '#search/query'
    module.navigationKeyListener({
      key: 'Escape',
      preventDefault: mock.fn(),
    })
    assert.strictEqual(window.location.hash, '#search/')
    assert.strictEqual(focusMock.mock.callCount(), 1)
  })
  it('toggles search strategy with Ctrl+F', async () => {
    const { module, viewModule } = await setupSearchNavigation()
    await viewModule.renderSearchResults()
    const preventDefault = mock.fn()

    // Default is 'precise' (set in setupSearchNavigation)
    assert.strictEqual(ext.opts.searchStrategy, 'precise')
    await module.navigationKeyListener({
      key: 'f',
      ctrlKey: true,
      preventDefault,
      stopPropagation: mock.fn(),
    })
    assert.strictEqual(preventDefault.mock.callCount(), 1)
    assert.strictEqual(ext.opts.searchStrategy, 'fuzzy')
    await module.navigationKeyListener({
      key: 'F',
      ctrlKey: true,
      preventDefault,
      stopPropagation: mock.fn(),
    })
    assert.strictEqual(ext.opts.searchStrategy, 'precise')
  })
  it('opens selected bookmark editor with F2', async () => {
    const { module, viewModule } = await setupSearchNavigation()
    await viewModule.renderSearchResults()
    const preventDefault = mock.fn()
    const errorSpy = mock.method(console, 'error', () => {})
    const editorUrl = await module.navigationKeyListener({
      key: 'F2',
      preventDefault,
    })
    assert.strictEqual(preventDefault.mock.callCount(), 1)
    assert.strictEqual(editorUrl, './editBookmark.html#bookmark/bm-1?return=%23search%2Fquery')
    errorSpy.mock.restore()
  })
  it('opens selected result in background with Ctrl+Enter', async () => {
    const { module, viewModule } = await setupSearchNavigation()
    await viewModule.renderSearchResults()
    const event = {
      key: 'Enter',
      ctrlKey: true,
      shiftKey: false,
      altKey: false,
      preventDefault: mock.fn(),
      stopPropagation: mock.fn(),
      button: 0,
      target: {
        nodeName: 'LI',
        getAttribute: () => null,
        className: '',
      },
    }
    window.location.hash = '#search/query'
    await module.navigationKeyListener(event)
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
  it('inserts two spaces when TAB is pressed in search input', async () => {
    const { module, elements } = await setupSearchNavigation()
    const preventDefault = mock.fn()
    const dispatchEvent = mock.fn()

    // Setup input state
    elements.searchInput.value = 'tag'
    elements.searchInput.selectionStart = 3
    elements.searchInput.selectionEnd = 3
    elements.searchInput.focus()
    elements.searchInput.dispatchEvent = dispatchEvent

    // JSDOM usually respects focus() for activeElement

    await module.navigationKeyListener({
      key: 'Tab',
      preventDefault,
    })
    assert.strictEqual(preventDefault.mock.callCount(), 1)
    assert.strictEqual(elements.searchInput.value, 'tag  ')
    assert.strictEqual(elements.searchInput.selectionStart, 5)
    assert.strictEqual(elements.searchInput.selectionEnd, 5)
    // Check that 'input' event was dispatched
    assert.strictEqual(dispatchEvent.mock.callCount(), 1)
    assert.strictEqual(dispatchEvent.mock.calls[0].arguments[0].type, 'input')
  })
})
