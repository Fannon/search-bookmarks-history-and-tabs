import '../../../../test/setup.js'
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { defaultOptions } from '../options.js'
import { validateOptions } from '../validateOptions.js'

describe('validateOptions', () => {
  test('accepts valid options', async () => {
    const result = await validateOptions({
      searchStrategy: 'fuzzy',
      enableDirectUrl: true,
      searchMaxResults: 10,
    })
    assert.deepStrictEqual(result, { valid: true, errors: [] })
  })
  test('accepts empty options object', async () => {
    const result = await validateOptions({})
    assert.deepStrictEqual(result, { valid: true, errors: [] })
  })
  test('accepts defaultOptions from options.js', async () => {
    const result = await validateOptions(defaultOptions)
    if (!result.valid) {
      console.error('Validation errors in defaultOptions:', result.errors)
    }
    assert.deepStrictEqual(result, { valid: true, errors: [] })
  })
  test('accepts options with default values', async () => {
    const result = await validateOptions({
      enableDirectUrl: false,
      quickBookmarkCurrentTab: 'Bookmarks bar',
      searchStrategy: 'precise',
      searchMaxResults: 24,
    })
    assert.deepStrictEqual(result, { valid: true, errors: [] })
  })
  test('accepts disabling quick bookmark current tab with false', async () => {
    const result = await validateOptions({
      quickBookmarkCurrentTab: false,
    })
    assert.deepStrictEqual(result, { valid: true, errors: [] })
  })
  test('accepts an empty quick bookmark current tab folder value', async () => {
    const result = await validateOptions({
      quickBookmarkCurrentTab: '',
    })
    assert.deepStrictEqual(result, { valid: true, errors: [] })
  })
  test('rejects values outside numeric bounds', async () => {
    const result = await validateOptions({
      searchMaxResults: 0,
    })
    assert.strictEqual(result.valid, false)
    assert(result.errors.includes('"searchMaxResults" must be >= 1'))
  })
  test('accepts minimum numeric bounds', async () => {
    const result = await validateOptions({
      searchMaxResults: 1,
      searchFuzzyness: 0,
      historyDaysAgo: 1,
    })
    assert.deepStrictEqual(result, { valid: true, errors: [] })
  })
  test('accepts maximum numeric bounds', async () => {
    const result = await validateOptions({
      searchFuzzyness: 1,
    })
    assert.deepStrictEqual(result, { valid: true, errors: [] })
  })
  test('rejects values above maximum numeric bounds', async () => {
    const result = await validateOptions({
      searchFuzzyness: 1.5,
    })
    assert.strictEqual(result.valid, false)
    assert(result.errors.includes('"searchFuzzyness" must be <= 1'))
  })
  test('accepts valid color hex patterns', async () => {
    const result = await validateOptions({
      bookmarkColor: '#3c8d8d',
      tabColor: '#FFF',
      historyColor: '#123456',
    })
    assert.deepStrictEqual(result, { valid: true, errors: [] })
  })
  test('rejects invalid color hex patterns', async () => {
    const result = await validateOptions({
      bookmarkColor: 'red',
      tabColor: '#GGG',
    })
    assert.strictEqual(result.valid, false)
    assert(result.errors.includes('"bookmarkColor" must match pattern ^#([0-9a-fA-F]{3}){1,2}$'))
    assert(result.errors.includes('"tabColor" must match pattern ^#([0-9a-fA-F]{3}){1,2}$'))
  })
  test('accepts valid enum values', async () => {
    const result = await validateOptions({
      searchStrategy: 'precise',
    })
    assert.deepStrictEqual(result, { valid: true, errors: [] })
  })
  test('rejects invalid enum values', async () => {
    const result = await validateOptions({
      searchStrategy: 'invalid',
    })
    assert.strictEqual(result.valid, false)
    assert(result.errors.includes('"searchStrategy" must be one of: precise, fuzzy'))
  })
  test('rejects invalid types', async () => {
    const result = await validateOptions({
      enableDirectUrl: 'true',
      searchMaxResults: '10',
      bookmarksIgnoreFolderList: 'folder',
    })
    assert.strictEqual(result.valid, false)
    assert(result.errors.includes('"enableDirectUrl" must be boolean'))
    assert(result.errors.includes('"searchMaxResults" must be integer'))
    assert(result.errors.includes('"bookmarksIgnoreFolderList" must be array'))
  })
  test('rejects invalid quick bookmark current tab values', async () => {
    const result = await validateOptions({
      quickBookmarkCurrentTab: true,
    })
    assert.strictEqual(result.valid, false)
    assert(result.errors[0].includes('"quickBookmarkCurrentTab" must match one of the allowed formats'))
  })
  test('rejects unknown options', async () => {
    const result = await validateOptions({
      unknownOption: 'value',
    })
    assert.strictEqual(result.valid, false)
    assert(result.errors.includes('Unknown option: "unknownOption"'))
  })
  test('rejects removed displayIcons option', async () => {
    const result = await validateOptions({
      displayIcons: true,
    })
    assert.strictEqual(result.valid, false)
    assert(result.errors.includes('Unknown option: "displayIcons"'))
  })
  test('validates nested objects (searchEngineChoices)', async () => {
    const result = await validateOptions({
      searchEngineChoices: [
        {
          name: 'Valid Engine',
          urlPrefix: 'https://example.com/s=$s',
        },
        {
          name: '', // Too short
        },
      ],
    })
    assert.strictEqual(result.valid, false)
    assert(result.errors.includes('"searchEngineChoices[1].name" must have length >= 1'))
    assert(result.errors.includes('"searchEngineChoices[1].urlPrefix" is required'))
  })
  test('validates customSearchEngines with anyOf', async () => {
    const resultStringAlias = await validateOptions({
      customSearchEngines: [
        {
          alias: 'g',
          name: 'Google',
          urlPrefix: 'https://google.com/q=$s',
        },
      ],
    })
    assert.strictEqual(resultStringAlias.valid, true)
    const resultArrayAlias = await validateOptions({
      customSearchEngines: [
        {
          alias: ['g', 'google'],
          name: 'Google',
          urlPrefix: 'https://google.com/q=$s',
        },
      ],
    })
    assert.strictEqual(resultArrayAlias.valid, true)
    const resultInvalidAlias = await validateOptions({
      customSearchEngines: [
        {
          alias: 123,
          name: 'Google',
          urlPrefix: 'https://google.com/q=$s',
        },
      ],
    })
    assert.strictEqual(resultInvalidAlias.valid, false)
    assert(
      resultInvalidAlias.errors[0].includes('"customSearchEngines[0].alias" must match one of the allowed formats'),
    )
  })
  test('rejects additional properties when disallowed', async () => {
    const result = await validateOptions({
      searchEngineChoices: [
        {
          name: 'Google',
          urlPrefix: 'https://google.com',
          extra: 'not allowed',
        },
      ],
    })
    assert.strictEqual(result.valid, false)
    assert(result.errors.includes('Unknown option: "searchEngineChoices[0].extra"'))
  })
  test('accepts null/undefined values by returning valid: true (legacy behavior)', async () => {
    assert.strictEqual((await validateOptions(null)).valid, true)
    assert.strictEqual((await validateOptions(undefined)).valid, true)
  })
  test('accepts zero values where allowed', async () => {
    const result = await validateOptions({
      maxRecentTabsToShow: 0,
      historyMaxItems: 0,
    })
    assert.deepStrictEqual(result, { valid: true, errors: [] })
  })
})
