import '../../../../test/setup.js'
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'
import { format } from 'node:util'
import { resetModules } from '../../../../test/modules.js'
import { matches } from '../../../../test/patterns.js'

/**
 * ✅ Covered behaviors: loading, saving, and resetting user options via the edit options view.
 * ⚠️ Known gaps: module-scoped isInitialized may prevent re-initialization across popup sessions, and location redirects are not asserted (jsdom limitation).
 * 🐞 Added BUG tests: none.
 */

function setupDom() {
  document.body.innerHTML = `
    <textarea id="config"></textarea>
    <button id="opt-save"></button>
    <button id="opt-reset"></button>
    <div id="error-message" style="display:none"></div>
  `
}
function setupOptionsFormDom() {
  document.body.innerHTML = `
    <section data-manager-panel="options">
      <div data-page-status></div>
      <form id="options-form"></form>
      <textarea id="config"></textarea>
      <button id="opt-save"></button>
      <button id="opt-reset"></button>
      <div id="error-message" style="display:none"></div>
    </section>
  `
}
function createJsonYamlMocks() {
  return {
    dump: mock.fn((value) => {
      if (!value || Object.keys(value).length === 0) return '{}'
      return JSON.stringify(value)
    }),
    load: mock.fn((value) => {
      if (!value) return undefined
      return JSON.parse(value)
    }),
  }
}
async function loadEditOptionsView({
  userOptions = {},
  getUserOptionsImpl,
  dumpImpl,
  loadImpl,
  setUserOptionsImpl,
  validateOptionsImpl,
} = {}) {
  resetModules()
  const getUserOptions = getUserOptionsImpl || mock.fn(() => Promise.resolve(userOptions))
  const setUserOptions =
    setUserOptionsImpl ||
    mock.fn(() => {
      return Promise.resolve()
    })
  const validateOptions =
    validateOptionsImpl ||
    mock.fn(() => {
      return Promise.resolve({ valid: true, errors: [] })
    })
  const dumpMock =
    dumpImpl ||
    mock.fn((value) => {
      if (!value || Object.keys(value).length === 0) {
        return '{}'
      }
      return JSON.stringify(value)
    })
  const loadMock =
    loadImpl ||
    mock.fn((yaml) => {
      if (yaml === 'invalid') {
        throw new Error('Invalid YAML')
      }
      return { parsed: yaml }
    })
  window.jsyaml = {
    dump: dumpMock,
    load: loadMock,
  }
  mock.module(new URL('../../model/optionsStorage.js', import.meta.url), {
    exports: {
      getUserOptions,
      setUserOptions,
    },
  })
  mock.module(new URL('../../model/validateOptions.js', import.meta.url), {
    exports: {
      validateOptions,
    },
  })
  const module = await import('../editOptionsView.js')
  return {
    module,
    mocks: {
      getUserOptions,
      setUserOptions,
      validateOptions,
      dump: dumpMock,
      load: loadMock,
    },
  }
}
beforeEach(() => {
  document.body.innerHTML = ''
  window.location.hash = ''
})
afterEach(() => {
  delete window.jsyaml
})
describe('editOptionsView', () => {
  it('initOptions populates textarea with serialized user options', async () => {
    setupDom()
    const { module, mocks } = await loadEditOptionsView({
      userOptions: { theme: 'dark' },
      dumpImpl: mock.fn(() => 'theme: dark'),
    })
    await module.initOptions()
    assert.strictEqual(mocks.getUserOptions.mock.callCount(), 1)
    assert(mocks.dump.mock.calls.some((call) => matches(call.arguments, [{ theme: 'dark' }])))
    assert.strictEqual(document.getElementById('config').value, 'theme: dark')
  })
  it('initOptions clears textarea when serialized options equal an empty object', async () => {
    setupDom()
    const dumpImpl = mock.fn(() => '{}')
    const { module, mocks } = await loadEditOptionsView({
      userOptions: {},
      dumpImpl,
    })
    await module.initOptions()
    assert(mocks.dump.mock.calls.some((call) => matches(call.arguments, [{}])))
    assert.strictEqual(document.getElementById('config').value, '')
  })
  it('initOptions preserves edits made before async options finish loading', async () => {
    setupDom()
    let resolveUserOptions
    const userOptionsPromise = new Promise((resolve) => {
      resolveUserOptions = resolve
    })
    const getUserOptions = mock.fn(() => userOptionsPromise)
    const { module, mocks } = await loadEditOptionsView({
      getUserOptionsImpl: getUserOptions,
      dumpImpl: mock.fn(() => 'searchMaxResults: 24'),
    })
    const initPromise = module.initOptions()
    document.getElementById('config').value = 'searchMaxResults: "not-a-number"'
    resolveUserOptions({ searchMaxResults: 24 })
    await initPromise
    assert(mocks.dump.mock.calls.some((call) => matches(call.arguments, [{ searchMaxResults: 24 }])))
    assert.strictEqual(document.getElementById('config').value, 'searchMaxResults: "not-a-number"')
  })
  it('saveOptions validates, normalizes YAML, persists options, and navigates back to search', async () => {
    setupDom()
    const loadImpl = mock.fn(() => ({ theme: 'dark' }))
    const dumpImpl = (() => {
      const fn = mock.fn(() => 'normalized: dark')
      fn.mock.mockImplementationOnce(() => 'theme: dark')
      return fn
    })()

    const { module, mocks } = await loadEditOptionsView({
      userOptions: { theme: 'dark' },
      dumpImpl,
      loadImpl,
    })
    await module.initOptions()
    document.getElementById('config').value = 'theme: dark'
    document.getElementById('opt-save').dispatchEvent(new MouseEvent('click'))
    await Promise.resolve()
    assert(mocks.load.mock.calls.some((call) => matches(call.arguments, ['theme: dark'])))
    assert(mocks.validateOptions.mock.calls.some((call) => matches(call.arguments, [{ theme: 'dark' }])))
    assert(mocks.setUserOptions.mock.calls.some((call) => matches(call.arguments, [{ theme: 'dark' }])))
    assert.strictEqual(document.getElementById('config').value, 'normalized: dark')
  })
  it('saveOptions treats empty YAML as empty options when js-yaml throws on empty input', async () => {
    setupDom()
    const loadImpl = mock.fn((value) => {
      if (value === '') {
        throw new Error('expected a document in the stream')
      }
      return { parsed: value }
    })
    const dumpImpl = mock.fn(() => '{}')
    const { module, mocks } = await loadEditOptionsView({
      userOptions: {},
      dumpImpl,
      loadImpl,
    })
    await module.initOptions()
    document.getElementById('config').value = ''
    document.getElementById('opt-save').dispatchEvent(new MouseEvent('click'))
    await Promise.resolve()
    assert(mocks.load.mock.callCount() === 0)
    assert(mocks.validateOptions.mock.calls.some((call) => matches(call.arguments, [{}])))
    assert(mocks.setUserOptions.mock.calls.some((call) => matches(call.arguments, [{}])))
    assert.strictEqual(document.getElementById('error-message').style.display, 'none')
  })
  ;[
    ['false', false],
    ['0', 0],
  ].forEach((testCase) => {
    const args = Array.isArray(testCase) ? testCase : [testCase]
    it(
      format(
        'saveOptions validates parsed falsy scalar YAML roots without coercing %s to empty options'.replace(
          /\$([a-zA-Z]+)/g,
          (_, key) => testCase[key],
        ),
        ...args,
      ),
      () =>
        (async (yamlValue, parsedValue) => {
          setupDom()
          const loadImpl = mock.fn(() => parsedValue)
          const dumpImpl = mock.fn(() => '{}')
          const { module, mocks } = await loadEditOptionsView({
            userOptions: {},
            dumpImpl,
            loadImpl,
            validateOptionsImpl: mock.fn(() => ({ valid: false, errors: ['"options" must be object'] })),
          })
          await module.initOptions()
          document.getElementById('config').value = yamlValue
          document.getElementById('opt-save').dispatchEvent(new MouseEvent('click'))
          await Promise.resolve()
          assert(mocks.load.mock.calls.some((call) => matches(call.arguments, [yamlValue])))
          assert(mocks.validateOptions.mock.calls.some((call) => matches(call.arguments, [parsedValue])))
          assert(mocks.setUserOptions.mock.callCount() === 0)
        })(...args),
    )
  })
  it('saveOptions displays an error message when YAML parsing fails', async () => {
    setupDom()
    const error = new Error('bad input')
    const loadImpl = mock.fn(() => {
      throw error
    })
    const { module, mocks } = await loadEditOptionsView({
      userOptions: {},
      dumpImpl: mock.fn(() => '{}'),
      loadImpl,
    })
    const errorSpy = mock.method(console, 'error', () => {})
    await module.initOptions()
    document.getElementById('config').value = 'invalid yaml'
    document.getElementById('opt-save').dispatchEvent(new MouseEvent('click'))
    await Promise.resolve()
    const errorMessageEl = document.getElementById('error-message')
    assert(mocks.setUserOptions.mock.callCount() === 0)
    assert.strictEqual(errorMessageEl.style.display, 'flex')
    assert(errorMessageEl.textContent.includes('Invalid Options'))
    assert(errorMessageEl.textContent.includes('bad input'))
    assert(errorMessageEl.textContent.includes('DISMISS'))
    assert(errorSpy.mock.calls.some((call) => matches(call.arguments, [error])))
    errorSpy.mock.restore()
  })
  it('saveOptions displays schema validation errors when validateOptions returns invalid', async () => {
    setupDom()
    const validateOptionsImpl = mock.fn(() =>
      Promise.resolve({
        valid: false,
        errors: ['searchMaxResults must be >= 1', 'displayScore must be boolean'],
      }),
    )
    const { module, mocks } = await loadEditOptionsView({
      userOptions: {},
      dumpImpl: mock.fn(() => '{}'),
      validateOptionsImpl,
    })
    const errorSpy = mock.method(console, 'error', () => {})
    await module.initOptions()
    document.getElementById('config').value = 'searchMaxResults: 0'
    document.getElementById('opt-save').dispatchEvent(new MouseEvent('click'))
    await Promise.resolve()
    const errorMessageEl = document.getElementById('error-message')
    assert(mocks.validateOptions.mock.callCount() > 0)
    assert(mocks.setUserOptions.mock.callCount() === 0) // Should NOT call setUserOptions when validation fails
    assert.strictEqual(errorMessageEl.style.display, 'flex')
    assert(errorMessageEl.textContent.includes('Invalid Options'))
    assert(errorMessageEl.textContent.includes('• searchMaxResults must be >= 1'))
    assert(errorMessageEl.textContent.includes('• displayScore must be boolean'))
    assert(errorMessageEl.textContent.includes('DISMISS'))
    errorSpy.mock.restore()
  })
  it('resetOptions clears the textarea value', async () => {
    setupDom()
    const { module } = await loadEditOptionsView({
      userOptions: {},
      dumpImpl: mock.fn(() => '{}'),
    })
    await module.initOptions()
    const input = document.getElementById('config')
    input.value = 'some config'
    document.getElementById('opt-reset').dispatchEvent(new MouseEvent('click'))
    await Promise.resolve()
    assert.strictEqual(input.value, '')
  })
  it('edits simple string arrays with inline rows', async () => {
    setupOptionsFormDom()
    const yaml = createJsonYamlMocks()
    const { module } = await loadEditOptionsView({
      userOptions: {},
      dumpImpl: yaml.dump,
      loadImpl: yaml.load,
    })
    await module.initOptions()
    const row = document.querySelector('[data-option-key="bookmarksIgnoreFolderList"]')
    row.querySelector('[data-option-enabled]').click()
    row.querySelector('[data-option-add-array-item]').click()
    const input = row.querySelector('[data-array-value]')
    input.value = 'Bookmarks/Archive'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    assert.deepStrictEqual(JSON.parse(document.getElementById('config').value), {
      bookmarksIgnoreFolderList: ['Bookmarks/Archive'],
    })
  })
  it('edits searchEngineChoices with inline rows', async () => {
    setupOptionsFormDom()
    const yaml = createJsonYamlMocks()
    const { module } = await loadEditOptionsView({
      userOptions: {},
      dumpImpl: yaml.dump,
      loadImpl: yaml.load,
    })
    await module.initOptions()
    const row = document.querySelector('[data-option-key="searchEngineChoices"]')
    row.querySelector('[data-option-enabled]').click()
    row.querySelector('[data-option-add-array-item]').click()
    const lastItem = row.querySelector('[data-option-array-item]:last-child')
    lastItem.querySelector('[data-array-field="name"]').value = 'Docs'
    lastItem.querySelector('[data-array-field="urlPrefix"]').value = 'https://docs.example/search?q=$s'
    lastItem.querySelector('[data-array-field="urlPrefix"]').dispatchEvent(new Event('input', { bubbles: true }))
    assert.deepStrictEqual(JSON.parse(document.getElementById('config').value), {
      searchEngineChoices: [
        {
          name: 'Google',
          urlPrefix: 'https://www.google.com/search?q=$s',
        },
        {
          name: 'Docs',
          urlPrefix: 'https://docs.example/search?q=$s',
        },
      ],
    })
  })
  it('saveOptions shows REMOVE UNKNOWN OPTIONS button for unknown options, and it works', async () => {
    setupDom()
    const validateOptionsImpl = mock.fn(() =>
      Promise.resolve({
        valid: false,
        errors: ['Unknown option: "unknownKey"'],
      }),
    )
    const { module, mocks } = await loadEditOptionsView({
      userOptions: {},
      dumpImpl: mock.fn(() => 'knownKey: value'),
      loadImpl: mock.fn(() => ({ knownKey: 'value' })),
      validateOptionsImpl,
    })
    await module.initOptions()
    document.getElementById('config').value = 'knownKey: value\nunknownKey: extra'

    // First save attempt shows the error with clean button
    document.getElementById('opt-save').dispatchEvent(new MouseEvent('click'))
    await Promise.resolve()
    const errorMessageEl = document.getElementById('error-message')
    assert(errorMessageEl.textContent.includes('REMOVE UNKNOWN OPTIONS'))

    // Click REMOVE UNKNOWN OPTIONS
    const btnClean = document.getElementById('btn-clean')
    assert.notStrictEqual(btnClean, null)

    // Second validate call for cleaning should return valid
    mocks.validateOptions.mock.mockImplementationOnce(() => Promise.resolve({ valid: true, errors: [] }))
    btnClean.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    // It should have cleaned the text but NOT called setUserOptions (user must save manually)
    assert(mocks.setUserOptions.mock.callCount() === 0)
    assert.strictEqual(errorMessageEl.style.display, 'none')
    assert.strictEqual(document.getElementById('config').value, 'knownKey: value')
  })
  it('REMOVE UNKNOWN OPTIONS also strips nested unknown properties', async () => {
    setupDom()
    const nestedOptions = {
      customSearchEngines: [
        {
          alias: 'gh',
          name: 'GitHub',
          urlPrefix: 'https://github.com/search?q=$s',
          extra: 'remove-me',
        },
      ],
      uFuzzyOptions: {
        intraMode: 1,
      },
    }
    const { module } = await loadEditOptionsView({
      userOptions: {},
      dumpImpl: mock.fn((value) => JSON.stringify(value, null, 2)),
      loadImpl: mock.fn(() => nestedOptions),
      validateOptionsImpl: mock.fn(() =>
        Promise.resolve({
          valid: false,
          errors: ['Unknown option: "customSearchEngines[0].extra"'],
        }),
      ),
    })
    await module.initOptions()
    document.getElementById('config').value = JSON.stringify(nestedOptions, null, 2)
    document.getElementById('opt-save').dispatchEvent(new MouseEvent('click'))
    await Promise.resolve()
    const btnClean = document.getElementById('btn-clean')
    assert.notStrictEqual(btnClean, null)
    btnClean.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await Promise.resolve()
    const cleanedOptions = JSON.parse(document.getElementById('config').value)
    assert(!('extra' in cleanedOptions.customSearchEngines[0]))
    assert.deepStrictEqual(cleanedOptions.uFuzzyOptions, { intraMode: 1 })
  })
  it('shows all rows when options filter is empty', async () => {
    setupOptionsFormDom()
    setupOptionsFilterEl()
    const yaml = createJsonYamlMocks()
    const { module } = await loadEditOptionsView({
      userOptions: {},
      dumpImpl: yaml.dump,
      loadImpl: yaml.load,
    })
    await module.initOptions()
    const filterEl = document.getElementById('options-filter')
    filterEl.value = ''
    filterEl.dispatchEvent(new Event('input'))
    const hiddenRows = document.querySelectorAll('.option-row.hidden-by-filter')
    assert.strictEqual(hiddenRows.length, 0)
  })
  it('finds history-related options by key but not unrelated ones', async () => {
    setupOptionsFormDom()
    setupOptionsFilterEl()
    const yaml = createJsonYamlMocks()
    const { module } = await loadEditOptionsView({
      userOptions: {},
      dumpImpl: yaml.dump,
      loadImpl: yaml.load,
    })
    await module.initOptions()
    const filterEl = document.getElementById('options-filter')
    filterEl.value = 'history'
    filterEl.dispatchEvent(new Event('input'))
    assert.strictEqual(rowIsVisible('historyColor'), true)
    assert.strictEqual(rowIsVisible('enableHistory'), true)
    assert.strictEqual(rowIsVisible('historyDaysAgo'), true)
    assert.strictEqual(rowIsVisible('historyMaxItems'), true)
    assert.strictEqual(rowIsVisible('historyIgnoreList'), true)
    assert.strictEqual(rowIsVisible('scoreHistoryBase'), true)
    assert.strictEqual(rowIsVisible('bookmarkColor'), false)
    assert.strictEqual(rowIsVisible('tabColor'), false)
    assert.strictEqual(rowIsVisible('scoreBookmarkBase'), false)
    const visibleCount = document.querySelectorAll('.option-row:not(.hidden-by-filter)').length
    const totalCount = document.querySelectorAll('.option-row').length
    assert(visibleCount < totalCount)
  })
  it('handles camelCase token splitting in option keys', async () => {
    setupOptionsFormDom()
    setupOptionsFilterEl()
    const yaml = createJsonYamlMocks()
    const { module } = await loadEditOptionsView({
      userOptions: {},
      dumpImpl: yaml.dump,
      loadImpl: yaml.load,
    })
    await module.initOptions()
    const filterEl = document.getElementById('options-filter')
    filterEl.value = 'score'
    filterEl.dispatchEvent(new Event('input'))
    assert.strictEqual(rowIsVisible('scoreBookmarkBase'), true)
    assert.strictEqual(rowIsVisible('scoreHistoryBase'), true)
    assert.strictEqual(rowIsVisible('scoreTabBase'), true)
    assert.strictEqual(rowIsVisible('bookmarkColor'), false)
  })
  it('finds options by their exact technical key', async () => {
    setupOptionsFormDom()
    setupOptionsFilterEl()
    const yaml = createJsonYamlMocks()
    const { module } = await loadEditOptionsView({
      userOptions: {},
      dumpImpl: yaml.dump,
      loadImpl: yaml.load,
    })
    await module.initOptions()
    const filterEl = document.getElementById('options-filter')
    filterEl.value = 'openInCurrentTab'
    filterEl.dispatchEvent(new Event('input'))
    assert.strictEqual(rowIsVisible('openInCurrentTab'), true)
    assert.strictEqual(rowIsVisible('searchStrategy'), false)
  })
  it('uses AND logic for multiple query tokens', async () => {
    setupOptionsFormDom()
    setupOptionsFilterEl()
    const yaml = createJsonYamlMocks()
    const { module } = await loadEditOptionsView({
      userOptions: {},
      dumpImpl: yaml.dump,
      loadImpl: yaml.load,
    })
    await module.initOptions()
    const filterEl = document.getElementById('options-filter')
    filterEl.value = 'score history'
    filterEl.dispatchEvent(new Event('input'))
    assert.strictEqual(rowIsVisible('scoreHistoryBase'), true)
    assert.strictEqual(rowIsVisible('scoreBookmarkBase'), false)
    assert.strictEqual(rowIsVisible('historyColor'), false)
  })
  it('matches description text as well as keys', async () => {
    setupOptionsFormDom()
    setupOptionsFilterEl()
    const yaml = createJsonYamlMocks()
    const { module } = await loadEditOptionsView({
      userOptions: {},
      dumpImpl: yaml.dump,
      loadImpl: yaml.load,
    })
    await module.initOptions()
    const filterEl = document.getElementById('options-filter')
    filterEl.value = 'favicon'
    filterEl.dispatchEvent(new Event('input'))
    assert.strictEqual(rowIsVisible('displayFavicons'), true)
    assert.strictEqual(rowIsVisible('bookmarkColor'), false)
  })
  it('hides sections whose rows are all filtered out', async () => {
    setupOptionsFormDom()
    setupOptionsFilterEl()
    const yaml = createJsonYamlMocks()
    const { module } = await loadEditOptionsView({
      userOptions: {},
      dumpImpl: yaml.dump,
      loadImpl: yaml.load,
    })
    await module.initOptions()
    const filterEl = document.getElementById('options-filter')
    filterEl.value = 'history'
    filterEl.dispatchEvent(new Event('input'))
    const visibleSections = document.querySelectorAll('.options-section-group:not(.hidden-by-filter)')
    const allSections = document.querySelectorAll('.options-section-group')
    assert(visibleSections.length < allSections.length)
  })
  it('handles special characters in filter input safely', async () => {
    await setupFilterTest()
    const filterEl = document.getElementById('options-filter')
    filterEl.value = '(score)'
    filterEl.dispatchEvent(new Event('input'))
    assert.strictEqual(rowIsVisible('scoreBookmarkBase'), true)
    assert.strictEqual(rowIsVisible('scoreHistoryBase'), true)
    assert.strictEqual(rowIsVisible('bookmarkColor'), false)
  })
  it('hides everything when no option matches', async () => {
    await setupFilterTest()
    const filterEl = document.getElementById('options-filter')
    filterEl.value = 'nonexistentzzz'
    filterEl.dispatchEvent(new Event('input'))
    const visibleRows = document.querySelectorAll('.option-row:not(.hidden-by-filter)')
    assert.strictEqual(visibleRows.length, 0)
  })
  it('clears all filters when input is emptied', async () => {
    await setupFilterTest()
    const filterEl = document.getElementById('options-filter')
    filterEl.value = 'history'
    filterEl.dispatchEvent(new Event('input'))
    assert.strictEqual(rowIsVisible('bookmarkColor'), false)
    filterEl.value = ''
    filterEl.dispatchEvent(new Event('input'))
    assert.strictEqual(rowIsVisible('bookmarkColor'), true)
    const hiddenRows = document.querySelectorAll('.option-row.hidden-by-filter')
    assert.strictEqual(hiddenRows.length, 0)
  })
  it('syncs form changes to YAML textarea', async () => {
    setupOptionsFormDom()
    setupOptionsFilterEl()
    const yaml = createJsonYamlMocks()
    const { module } = await loadEditOptionsView({
      userOptions: {},
      dumpImpl: yaml.dump,
      loadImpl: yaml.load,
    })
    await module.initOptions()
    const row = document.querySelector('[data-option-key="bookmarkColor"]')
    row.querySelector('[data-option-enabled]').click()
    const input = row.querySelector('[data-option-input]')
    input.value = '#ff0000'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    const dumpedValues = yaml.dump.mock.calls.map((call) => call.arguments).map((c) => c[0])
    const lastDumped = dumpedValues[dumpedValues.length - 1]
    assert('bookmarkColor' in lastDumped)
    assert.deepStrictEqual(lastDumped.bookmarkColor, '#ff0000')
  })
  it('edits openInCurrentTab through the options form', async () => {
    setupOptionsFormDom()
    setupOptionsFilterEl()
    const yaml = createJsonYamlMocks()
    const { module, mocks } = await loadEditOptionsView({
      userOptions: {},
      dumpImpl: yaml.dump,
      loadImpl: yaml.load,
    })
    await module.initOptions()
    const row = document.querySelector('[data-option-key="openInCurrentTab"]')
    assert.notStrictEqual(row, null)
    assert(row.closest('.options-section-group').textContent.includes('Search'))
    row.querySelector('[data-option-enabled]').click()
    const input = row.querySelector('[data-option-input]')
    assert.strictEqual(input.type, 'checkbox')
    input.click()
    const dumpedValues = yaml.dump.mock.calls.map((call) => call.arguments).map((c) => c[0])
    const lastDumped = dumpedValues[dumpedValues.length - 1]
    assert('openInCurrentTab' in lastDumped)
    assert.deepStrictEqual(lastDumped.openInCurrentTab, true)
    document.getElementById('opt-save').dispatchEvent(new MouseEvent('click'))
    await Promise.resolve()
    assert(mocks.validateOptions.mock.calls.some((call) => matches(call.arguments, [{ openInCurrentTab: true }])))
    assert(mocks.setUserOptions.mock.calls.some((call) => matches(call.arguments, [{ openInCurrentTab: true }])))
  })
  it('edits quickBookmarkCurrentTab as a string and preserves an empty value', async () => {
    setupOptionsFormDom()
    setupOptionsFilterEl()
    const yaml = createJsonYamlMocks()
    const { module, mocks } = await loadEditOptionsView({
      userOptions: {},
      dumpImpl: yaml.dump,
      loadImpl: yaml.load,
    })
    await module.initOptions()
    const row = document.querySelector('[data-option-key="quickBookmarkCurrentTab"]')
    assert.notStrictEqual(row, null)
    assert(row.closest('.options-section-group').textContent.includes('Sources'))
    row.querySelector('[data-option-enabled]').click()
    const input = row.querySelector('[data-option-input]')
    assert.strictEqual(input.type, 'text')
    assert.strictEqual(input.value, 'Bookmarks bar')
    input.value = ''
    input.dispatchEvent(new Event('input', { bubbles: true }))
    const dumpedValues = yaml.dump.mock.calls.map((call) => call.arguments).map((c) => c[0])
    const lastDumped = dumpedValues[dumpedValues.length - 1]
    assert('quickBookmarkCurrentTab' in lastDumped)
    assert.deepStrictEqual(lastDumped.quickBookmarkCurrentTab, '')
    document.getElementById('opt-save').dispatchEvent(new MouseEvent('click'))
    await Promise.resolve()
    assert(mocks.validateOptions.mock.calls.some((call) => matches(call.arguments, [{ quickBookmarkCurrentTab: '' }])))
    assert(mocks.setUserOptions.mock.calls.some((call) => matches(call.arguments, [{ quickBookmarkCurrentTab: '' }])))
  })
  it('shows disabled quickBookmarkCurrentTab values as an empty text field', async () => {
    setupOptionsFormDom()
    setupOptionsFilterEl()
    const yaml = createJsonYamlMocks()
    const { module } = await loadEditOptionsView({
      userOptions: { quickBookmarkCurrentTab: false },
      dumpImpl: yaml.dump,
      loadImpl: yaml.load,
    })
    await module.initOptions()
    const row = document.querySelector('[data-option-key="quickBookmarkCurrentTab"]')
    assert.strictEqual(row.querySelector('[data-option-enabled]').checked, true)
    assert.strictEqual(row.querySelector('[data-option-input]').value, '')
  })
  it('syncs YAML changes to form fields', async () => {
    setupOptionsFormDom()
    setupOptionsFilterEl()
    const yaml = createJsonYamlMocks()
    const updatedOptions = { bookmarkColor: '#123456' }
    const { module } = await loadEditOptionsView({
      userOptions: updatedOptions,
      dumpImpl: yaml.dump,
      loadImpl: yaml.load,
    })
    await module.initOptions()
    const row = document.querySelector('[data-option-key="bookmarkColor"]')
    const input = row.querySelector('[data-option-input]')
    assert.strictEqual(input.value, '#123456')
    assert.strictEqual(row.querySelector('[data-option-enabled]').checked, true)
  })
})
async function setupFilterTest() {
  setupOptionsFormDom()
  setupOptionsFilterEl()
  const yaml = createJsonYamlMocks()
  const result = await loadEditOptionsView({
    userOptions: {},
    dumpImpl: yaml.dump,
    loadImpl: yaml.load,
  })
  await result.module.initOptions()
  return result
}
function setupOptionsFilterEl() {
  const filterInput = document.createElement('input')
  filterInput.id = 'options-filter'
  filterInput.type = 'search'
  document.body.appendChild(filterInput)
}
function rowIsVisible(key) {
  const row = document.querySelector(`[data-option-key="${key}"]`)
  if (!row) return null
  return !row.classList.contains('hidden-by-filter')
}
