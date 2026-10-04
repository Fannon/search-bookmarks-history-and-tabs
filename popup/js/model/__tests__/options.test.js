import '../../../../test/setup.js'
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, mock, test } from 'node:test'
import { resetModules } from '../../../../test/modules.js'
import { any, containsText, matches } from '../../../../test/patterns.js'
/**
 * Node.js unit tests for options.js
 *
 * ## Behaviors Covered:
 * - validateUserOptions: Input validation, type checking, circular reference detection
 * - setUserOptions: Sync storage fallback to localStorage, error handling (no validation - see editOptionsView)
 * - getUserOptions: Sync storage fallback to localStorage, malformed JSON handling
 * - getEffectiveOptions: Merging defaults with user options, error recovery
 * - Constants: Structure validation for defaultOptions
 * - Integration: Complete workflows and error scenarios
 *
 * ## Known Gaps:
 * - No tests for browser-specific storage implementations
 * - No performance tests for large option objects
 * - No tests for concurrent access scenarios
 *
 * ## BUG: Tests Added:
 * - None - all tests verify existing functionality
 */

import { clearTestExt, createTestExt } from '../../__tests__/testUtils.js'
import { printError } from '../../view/errorView.js'

const mockPrintError = mock.fn(printError)
describe('options model', () => {
  let optionsModule
  beforeEach(async () => {
    localStorage.clear()
    mockPrintError.mock.resetCalls()
    resetModules()
    mock.module(new URL('../../view/errorView.js', import.meta.url), {
      exports: { printError: mockPrintError },
    })
    optionsModule = await import('../options.js')
  })
  afterEach(() => {
    clearTestExt()
  })
  describe('validateUserOptions', () => {
    test('accepts valid objects', () => {
      const validObject = { searchStrategy: 'fuzzy' }
      assert.deepStrictEqual(optionsModule.validateUserOptions(validObject), validObject)
      assert.deepStrictEqual(optionsModule.validateUserOptions({}), {})
      assert.deepStrictEqual(optionsModule.validateUserOptions(null), {})
      assert.deepStrictEqual(optionsModule.validateUserOptions(undefined), {})
    })
    test('rejects invalid structures', () => {
      assert.throws(
        () => optionsModule.validateUserOptions('string'),
        new RegExp(RegExp.escape('User options must be a valid YAML / JSON object')),
      )
      assert.throws(
        () => optionsModule.validateUserOptions(123),
        new RegExp(RegExp.escape('User options must be a valid YAML / JSON object')),
      )
    })
    test('rejects circular references', () => {
      const circular = {}
      circular.self = circular
      assert.throws(() => optionsModule.validateUserOptions(circular), /User options cannot be parsed into JSON/)
    })
    test('removes unknown options and logs warning', () => {
      const warnSpy = mock.method(console, 'warn', () => {})
      const optionsWithUnknown = { searchStrategy: 'fuzzy', unknownOption: 'value' }
      const result = optionsModule.validateUserOptions(optionsWithUnknown)
      assert.deepStrictEqual(result, { searchStrategy: 'fuzzy' })
      assert(
        warnSpy.mock.calls.some((call) =>
          matches(call.arguments, [containsText('Unknown user option: "unknownOption"')]),
        ),
      )
      warnSpy.mock.restore()
    })
  })
  describe('setUserOptions', () => {
    test('saves through sync storage when available', async () => {
      const syncSet = mock.fn((_payload, callback) => callback())
      createTestExt({
        browserApi: {
          storage: { sync: { set: syncSet } },
          runtime: {},
        },
      })
      assert.strictEqual(await optionsModule.setUserOptions({ searchStrategy: 'fuzzy' }), undefined)
      assert(
        syncSet.mock.calls.some((call) =>
          matches(call.arguments, [{ userOptions: { searchStrategy: 'fuzzy' } }, any(Function)]),
        ),
      )
    })
    test('falls back to localStorage when sync storage missing', async () => {
      createTestExt({ browserApi: {} })
      assert.strictEqual(await optionsModule.setUserOptions({ enableDirectUrl: false }), undefined)
      assert.strictEqual(localStorage.getItem('userOptions'), JSON.stringify({ enableDirectUrl: false }))
    })
    test('handles storage API errors', async () => {
      const runtimeError = new Error('Storage quota exceeded')
      const syncSet = mock.fn((_payload, callback) => {
        global.ext.browserApi.runtime.lastError = runtimeError
        callback()
      })
      createTestExt({
        browserApi: {
          storage: { sync: { set: syncSet } },
          runtime: {},
        },
      })
      await assert.rejects(optionsModule.setUserOptions({ searchStrategy: 'fuzzy' }), runtimeError)
    })

    // Note: setUserOptions no longer validates options against the schema.
    // Validation is now done separately in editOptionsView.js using validateOptions().
    // This design keeps the validation code (and its dependencies) out of the initSearch bundle.
  })
  describe('getUserOptions', () => {
    test('reads from sync storage when available', async () => {
      const syncGet = mock.fn((_keys, callback) => callback({ userOptions: { searchStrategy: 'precise' } }))
      createTestExt({
        browserApi: {
          storage: { sync: { get: syncGet } },
          runtime: {},
        },
      })
      assert.deepStrictEqual(await optionsModule.getUserOptions(), {
        searchStrategy: 'precise',
      })
      assert(syncGet.mock.calls.some((call) => matches(call.arguments, [['userOptions'], any(Function)])))
    })
    test('removes legacy displayIcons option from sync storage values', async () => {
      const syncGet = mock.fn((_keys, callback) =>
        callback({ userOptions: { displayIcons: true, displayFavicons: true } }),
      )
      createTestExt({
        browserApi: {
          storage: { sync: { get: syncGet } },
          runtime: {},
        },
      })
      assert.deepStrictEqual(await optionsModule.getUserOptions(), {
        displayFavicons: true,
      })
    })
    test('falls back to localStorage when sync storage missing', async () => {
      createTestExt({ browserApi: {} })
      localStorage.setItem(
        'userOptions',
        JSON.stringify({
          searchMaxResults: 5,
        }),
      )
      assert.deepStrictEqual(await optionsModule.getUserOptions(), {
        searchMaxResults: 5,
      })
    })
    test('removes legacy displayIcons option from localStorage values', async () => {
      createTestExt({ browserApi: {} })
      localStorage.setItem('userOptions', JSON.stringify({ displayIcons: true, searchMaxResults: 5 }))
      assert.deepStrictEqual(await optionsModule.getUserOptions(), {
        searchMaxResults: 5,
      })
    })
    test('returns empty object when no user options exist', async () => {
      createTestExt({ browserApi: {} })
      assert.deepStrictEqual(await optionsModule.getUserOptions(), {})
    })
    test('handles malformed JSON in localStorage', async () => {
      createTestExt({ browserApi: {} })
      localStorage.setItem('userOptions', 'invalid json{')
      await assert.rejects(optionsModule.getUserOptions())
    })
    test('handles storage API errors', async () => {
      const runtimeError = new Error('Storage API unavailable')
      const syncGet = mock.fn((_keys, callback) => {
        global.ext.browserApi.runtime.lastError = runtimeError
        callback()
      })
      createTestExt({
        browserApi: {
          storage: { sync: { get: syncGet } },
          runtime: {},
        },
      })
      await assert.rejects(optionsModule.getUserOptions(), runtimeError)
    })
  })
  describe('getEffectiveOptions', () => {
    test('merges defaults with user overrides', async () => {
      // Use localStorage to simulate user options
      createTestExt({ browserApi: {} })
      localStorage.setItem('userOptions', JSON.stringify({ searchMaxResults: 10, enableDirectUrl: false }))
      const effective = await optionsModule.getEffectiveOptions()
      assert.strictEqual(effective.searchMaxResults, 10)
      assert.strictEqual(effective.enableDirectUrl, false)
      assert.strictEqual(effective.bookmarkColor, optionsModule.defaultOptions.bookmarkColor)
    })
    test('returns defaults when user options are empty', async () => {
      createTestExt({ browserApi: {} })
      localStorage.setItem('userOptions', JSON.stringify({}))
      const effective = await optionsModule.getEffectiveOptions()
      assert.deepStrictEqual(effective, optionsModule.defaultOptions)
    })
  })
  describe('constants', () => {
    test('defaultOptions has expected structure', () => {
      assert.notStrictEqual(optionsModule.defaultOptions, undefined)
      assert.strictEqual(typeof optionsModule.defaultOptions, 'object')
      assert.strictEqual(optionsModule.defaultOptions.searchStrategy, 'precise')
      assert.strictEqual(typeof optionsModule.defaultOptions.searchMaxResults, 'number')
      assert.strictEqual(Array.isArray(optionsModule.defaultOptions.bookmarksIgnoreFolderList), true)
    })
    test('defaultOptions contains all required option categories', () => {
      const requiredCategories = [
        'searchStrategy',
        'searchMaxResults',
        'bookmarkColor',
        'tabColor',
        'historyColor',
        'searchColor',
        'enableTabs',
        'enableBookmarks',
        'enableHistory',
        'displayTags',
        'displayFolderName',
        'displaySearchMatchHighlight',
        'scoreBookmarkBase',
        'scoreTabBase',
      ]
      requiredCategories.forEach((category) => {
        assert(category in optionsModule.defaultOptions)
      })
    })
  })
  describe('integration scenarios', () => {
    test('complete workflow: set, get, and merge options', async () => {
      // Start with no browser API to use localStorage
      createTestExt({ browserApi: {} })

      // Set user options
      await optionsModule.setUserOptions({ searchMaxResults: 20, historyMaxItems: 2048 })

      // Get user options
      const userOptions = await optionsModule.getUserOptions()
      assert.deepStrictEqual(userOptions, { searchMaxResults: 20, historyMaxItems: 2048 })

      // Get effective options (should merge with defaults)
      const effectiveOptions = await optionsModule.getEffectiveOptions()
      assert.strictEqual(effectiveOptions.searchMaxResults, 20)
      assert.strictEqual(effectiveOptions.historyMaxItems, 2048)
      assert.strictEqual(effectiveOptions.bookmarkColor, optionsModule.defaultOptions.bookmarkColor)
      assert(mockPrintError.mock.callCount() === 0)
    })
    test('effective options report invalid stored options before falling back to defaults', async () => {
      createTestExt({ browserApi: {} })
      document.body.innerHTML = '<div id="error-overlay"></div>'
      localStorage.setItem('userOptions', 'invalid json{')
      assert.deepStrictEqual(await optionsModule.getEffectiveOptions(), optionsModule.defaultOptions)
      assert(
        document
          .getElementById('error-overlay')
          .textContent.includes('Could not get valid user options, falling back to defaults.'),
      )
    })
  })
})
