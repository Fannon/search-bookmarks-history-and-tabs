/**
 * Jest unit tests for options.js
 *
 * ## Behaviors Covered:
 * - validateUserOptions: Input validation, type checking, circular reference detection
 * - setUserOptions: Sync storage fallback to localStorage, error handling, validation
 * - getUserOptions: Sync storage fallback to localStorage, malformed JSON handling
 * - getEffectiveOptions: Merging defaults with user options, error recovery
 * - Constants: Structure validation for defaultOptions and emptyOptions
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

import { jest } from '@jest/globals'
import { createTestExt, clearTestExt } from '../../__tests__/testUtils.js'

// Mock the utils module
const mockPrintError = jest.fn()
jest.mock('../../helper/utils.js', () => ({
  __esModule: true,
  printError: mockPrintError,
}))

describe('options model', () => {
  let optionsModule

  beforeEach(async () => {
    localStorage.clear()
    jest.clearAllMocks()
    mockPrintError.mockClear()
    jest.resetModules()
    optionsModule = await import('../options.js')
  })

  afterEach(() => {
    clearTestExt()
  })

  describe('validateUserOptions', () => {
    test('accepts valid objects', () => {
      expect(() => optionsModule.validateUserOptions({ searchStrategy: 'fuzzy' })).not.toThrow()
      expect(() => optionsModule.validateUserOptions({})).not.toThrow()
      expect(() => optionsModule.validateUserOptions(null)).not.toThrow()
      expect(() => optionsModule.validateUserOptions(undefined)).not.toThrow()
    })

    test('rejects invalid structures', () => {
      expect(() => optionsModule.validateUserOptions('string')).toThrow(
        'User options must be a valid YAML / JSON object',
      )
      expect(() => optionsModule.validateUserOptions(123)).toThrow('User options must be a valid YAML / JSON object')
    })

    test('rejects circular references', () => {
      const circular = {}
      circular.self = circular
      expect(() => optionsModule.validateUserOptions(circular)).toThrow(/User options cannot be parsed into JSON/)
    })
  })

  describe('setUserOptions', () => {
    test('saves through sync storage when available', async () => {
      const syncSet = jest.fn((payload, callback) => callback())
      createTestExt({
        browserApi: {
          storage: { sync: { set: syncSet } },
          runtime: {},
        },
      })

      await expect(optionsModule.setUserOptions({ searchStrategy: 'fuzzy' })).resolves.toBeUndefined()
      expect(syncSet).toHaveBeenCalledWith({ userOptions: { searchStrategy: 'fuzzy' } }, expect.any(Function))
    })

    test('falls back to localStorage when sync storage missing', async () => {
      createTestExt({
        browserApi: {},
      })

      await expect(optionsModule.setUserOptions({ enableHelp: false })).resolves.toBeUndefined()
      expect(localStorage.getItem('userOptions')).toBe(JSON.stringify({ enableHelp: false }))
    })

    test('handles storage API errors', async () => {
      const runtimeError = new Error('Storage quota exceeded')
      const syncSet = jest.fn((payload, callback) => {
        // Simulate runtime error
        global.ext.browserApi.runtime.lastError = runtimeError
        callback()
      })

      createTestExt({
        browserApi: {
          storage: { sync: { set: syncSet } },
          runtime: {},
        },
      })

      await expect(optionsModule.setUserOptions({ searchStrategy: 'fuzzy' })).rejects.toThrow(runtimeError)
    })
  })

  describe('getUserOptions', () => {
    test('reads from sync storage when available', async () => {
      const syncGet = jest.fn((keys, callback) => callback({ userOptions: { searchStrategy: 'precise' } }))
      createTestExt({
        browserApi: {
          storage: { sync: { get: syncGet } },
          runtime: {},
        },
      })

      await expect(optionsModule.getUserOptions()).resolves.toEqual({ searchStrategy: 'precise' })
      expect(syncGet).toHaveBeenCalledWith(['userOptions'], expect.any(Function))
    })

    test('falls back to localStorage when sync storage missing', async () => {
      createTestExt({
        browserApi: {},
      })
      localStorage.setItem('userOptions', JSON.stringify({ searchMaxResults: 5 }))

      await expect(optionsModule.getUserOptions()).resolves.toEqual({ searchMaxResults: 5 })
    })

    test('returns emptyOptions when no user options exist', async () => {
      createTestExt({
        browserApi: {},
      })

      await expect(optionsModule.getUserOptions()).resolves.toEqual(optionsModule.emptyOptions)
    })

    test('handles malformed JSON in localStorage', async () => {
      createTestExt({
        browserApi: {},
      })
      localStorage.setItem('userOptions', 'invalid json{')

      await expect(optionsModule.getUserOptions()).rejects.toThrow()
    })

    test('handles storage API errors', async () => {
      const runtimeError = new Error('Storage API unavailable')
      const syncGet = jest.fn((keys, callback) => {
        global.ext.browserApi.runtime.lastError = runtimeError
        callback()
      })

      createTestExt({
        browserApi: {
          storage: { sync: { get: syncGet } },
          runtime: {},
        },
      })

      await expect(optionsModule.getUserOptions()).rejects.toThrow(runtimeError)
    })
  })

  describe('getEffectiveOptions', () => {
    test('merges defaults with user overrides', async () => {
      // Use localStorage to simulate user options
      createTestExt({ browserApi: {} })
      localStorage.setItem('userOptions', JSON.stringify({ searchMaxResults: 10, debug: true }))

      const effective = await optionsModule.getEffectiveOptions()
      expect(effective.searchMaxResults).toBe(10)
      expect(effective.debug).toBe(true)
      expect(effective.bookmarkColor).toBe(optionsModule.defaultOptions.bookmarkColor)
    })

    test('returns defaults when user options are empty', async () => {
      createTestExt({ browserApi: {} })
      localStorage.setItem('userOptions', JSON.stringify({}))

      const effective = await optionsModule.getEffectiveOptions()
      expect(effective).toEqual(optionsModule.defaultOptions)
    })
  })

  describe('constants', () => {
    test('defaultOptions has expected structure', () => {
      expect(optionsModule.defaultOptions).toBeDefined()
      expect(typeof optionsModule.defaultOptions).toBe('object')
      expect(optionsModule.defaultOptions.searchStrategy).toBe('precise')
      expect(typeof optionsModule.defaultOptions.searchMaxResults).toBe('number')
      expect(Array.isArray(optionsModule.defaultOptions.bookmarksIgnoreFolderList)).toBe(true)
    })

    test('emptyOptions has expected structure', () => {
      expect(optionsModule.emptyOptions).toBeDefined()
      expect(typeof optionsModule.emptyOptions).toBe('object')
      expect(optionsModule.emptyOptions.searchStrategy).toBe('precise')
      expect(Object.keys(optionsModule.emptyOptions).length).toBe(1)
    })

    test('defaultOptions contains all required option categories', () => {
      const requiredCategories = [
        'searchStrategy',
        'searchMaxResults',
        'searchMinMatchCharLength',
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
        'scoreMinScore',
        'scoreBookmarkBaseScore',
        'scoreTabBaseScore',
      ]

      requiredCategories.forEach((category) => {
        expect(optionsModule.defaultOptions).toHaveProperty(category)
      })
    })
  })

  describe('integration scenarios', () => {
    test('complete workflow: set, get, and merge options', async () => {
      // Start with no browser API to use localStorage
      createTestExt({ browserApi: {} })

      // Set user options
      await optionsModule.setUserOptions({ searchMaxResults: 20, colorStripeWidth: 5 })

      // Get user options
      const userOptions = await optionsModule.getUserOptions()
      expect(userOptions).toEqual({ searchMaxResults: 20, colorStripeWidth: 5 })

      // Get effective options (should merge with defaults)
      const effectiveOptions = await optionsModule.getEffectiveOptions()
      expect(effectiveOptions.searchMaxResults).toBe(20)
      expect(effectiveOptions.colorStripeWidth).toBe(5)
      expect(effectiveOptions.bookmarkColor).toBe(optionsModule.defaultOptions.bookmarkColor)

      expect(mockPrintError).not.toHaveBeenCalled()
    })
  })
})
