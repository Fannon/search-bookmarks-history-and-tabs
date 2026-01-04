import { defaultOptions } from '../options.js'
import { validateOptions } from '../validateOptions.js'

describe('validateOptions', () => {
  test('accepts valid options', async () => {
    const result = await validateOptions({
      searchStrategy: 'fuzzy',
      debug: true,
      searchMaxResults: 10,
    })

    expect(result).toEqual({ valid: true, errors: [] })
  })

  test('accepts empty options object', async () => {
    const result = await validateOptions({})

    expect(result).toEqual({ valid: true, errors: [] })
  })

  test('accepts defaultOptions from options.js', async () => {
    const result = await validateOptions(defaultOptions)
    if (!result.valid) {
      console.error('Validation errors in defaultOptions:', result.errors)
    }
    expect(result).toEqual({ valid: true, errors: [] })
  })

  test('accepts options with default values', async () => {
    const result = await validateOptions({
      debug: false,
      searchStrategy: 'precise',
      searchMaxResults: 24,
    })

    expect(result).toEqual({ valid: true, errors: [] })
  })

  test('rejects values outside numeric bounds', async () => {
    const result = await validateOptions({
      searchMaxResults: 0,
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('"searchMaxResults" must be >= 1')
  })

  test('accepts minimum numeric bounds', async () => {
    const result = await validateOptions({
      searchMaxResults: 1,
      searchFuzzyness: 0,
      searchDebounceMs: 0,
      historyDaysAgo: 1,
    })

    expect(result).toEqual({ valid: true, errors: [] })
  })

  test('accepts maximum numeric bounds', async () => {
    const result = await validateOptions({
      searchFuzzyness: 1,
    })

    expect(result).toEqual({ valid: true, errors: [] })
  })

  test('rejects values above maximum numeric bounds', async () => {
    const result = await validateOptions({
      searchFuzzyness: 1.5,
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('"searchFuzzyness" must be <= 1')
  })

  test('accepts valid color hex patterns', async () => {
    const result = await validateOptions({
      bookmarkColor: '#3c8d8d',
      tabColor: '#FFF',
      historyColor: '#123456',
    })

    expect(result).toEqual({ valid: true, errors: [] })
  })

  test('rejects invalid color hex patterns', async () => {
    const result = await validateOptions({
      bookmarkColor: 'red',
      tabColor: '#GGG',
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('"bookmarkColor" must match pattern ^#([0-9a-fA-F]{3}){1,2}$')
    expect(result.errors).toContain('"tabColor" must match pattern ^#([0-9a-fA-F]{3}){1,2}$')
  })

  test('accepts valid enum values', async () => {
    const result = await validateOptions({
      searchStrategy: 'precise',
    })

    expect(result).toEqual({ valid: true, errors: [] })
  })

  test('rejects invalid enum values', async () => {
    const result = await validateOptions({
      searchStrategy: 'invalid',
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('"searchStrategy" must be one of: precise, fuzzy')
  })

  test('rejects invalid types', async () => {
    const result = await validateOptions({
      debug: 'true',
      searchMaxResults: '10',
      bookmarksIgnoreFolderList: 'folder',
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('"debug" must be boolean')
    expect(result.errors).toContain('"searchMaxResults" must be integer')
    expect(result.errors).toContain('"bookmarksIgnoreFolderList" must be array')
  })

  test('rejects unknown options', async () => {
    const result = await validateOptions({
      unknownOption: 'value',
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Unknown option: "unknownOption"')
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

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('"searchEngineChoices[1].name" must have length >= 1')
    expect(result.errors).toContain('"searchEngineChoices[1].urlPrefix" is required')
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
    expect(resultStringAlias.valid).toBe(true)

    const resultArrayAlias = await validateOptions({
      customSearchEngines: [
        {
          alias: ['g', 'google'],
          name: 'Google',
          urlPrefix: 'https://google.com/q=$s',
        },
      ],
    })
    expect(resultArrayAlias.valid).toBe(true)

    const resultInvalidAlias = await validateOptions({
      customSearchEngines: [
        {
          alias: 123,
          name: 'Google',
          urlPrefix: 'https://google.com/q=$s',
        },
      ],
    })
    expect(resultInvalidAlias.valid).toBe(false)
    expect(resultInvalidAlias.errors[0]).toContain(
      '"customSearchEngines[0].alias" must match one of the allowed formats',
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

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Unknown option: "searchEngineChoices[0].extra"')
  })

  test('accepts null/undefined values by returning valid: true (legacy behavior)', async () => {
    expect((await validateOptions(null)).valid).toBe(true)
    expect((await validateOptions(undefined)).valid).toBe(true)
  })

  test('accepts zero values where allowed', async () => {
    const result = await validateOptions({
      maxRecentTabsToShow: 0,
      historyMaxItems: 0,
    })

    expect(result).toEqual({ valid: true, errors: [] })
  })
})
