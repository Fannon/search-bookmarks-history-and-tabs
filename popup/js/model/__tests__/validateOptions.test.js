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

  test('accepts options with default values', async () => {
    const result = await validateOptions({
      debug: false,
      searchStrategy: 'precise',
      searchMaxResults: 32,
    })

    expect(result).toEqual({ valid: true, errors: [] })
  })

  test('rejects values outside numeric bounds', async () => {
    const result = await validateOptions({
      searchMaxResults: 0,
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('searchMaxResults must be >= 1')
  })

  test('accepts minimum numeric bounds', async () => {
    const result = await validateOptions({
      searchMaxResults: 1,
      searchMinMatchCharLength: 1,
      searchFuzzyness: 0,
      searchDebounceMs: 0,
      colorStripeWidth: 0,
      historyDaysAgo: 1,
      scoreMinScore: 0,
    })

    expect(result).toEqual({ valid: true, errors: [] })
  })

  test('accepts maximum numeric bounds', async () => {
    const result = await validateOptions({
      searchFuzzyness: 1,
      colorStripeWidth: 16,
    })

    expect(result).toEqual({ valid: true, errors: [] })
  })

  test('rejects values above maximum numeric bounds', async () => {
    const result = await validateOptions({
      searchFuzzyness: 1.5,
      colorStripeWidth: 20,
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('searchFuzzyness must be <= 1')
    expect(result.errors).toContain('colorStripeWidth must be <= 16')
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
    expect(result.errors).toContain('bookmarkColor must match pattern ^#([0-9a-fA-F]{3}){1,2}$')
    expect(result.errors).toContain('tabColor must match pattern ^#([0-9a-fA-F]{3}){1,2}$')
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
    expect(result.errors).toContain('searchStrategy must be one of precise, fuzzy')
  })

  test('accepts valid boolean values', async () => {
    const result = await validateOptions({
      debug: true,
      enableTabs: false,
      enableBookmarks: true,
      displayTags: false,
    })

    expect(result).toEqual({ valid: true, errors: [] })
  })

  test('accepts valid array properties', async () => {
    const result = await validateOptions({
      bookmarksIgnoreFolderList: ['folder1', 'folder2'],
      historyIgnoreList: ['extension://'],
      searchEngineChoices: [
        {
          name: 'Google',
          urlPrefix: 'https://www.google.com/search?q=$s',
        },
      ],
      customSearchEngines: [
        {
          alias: ['g', 'google'],
          name: 'Google',
          urlPrefix: 'https://www.google.com/search?q=$s',
        },
      ],
    })

    expect(result).toEqual({ valid: true, errors: [] })
  })

  test('rejects invalid array items', async () => {
    const result = await validateOptions({
      bookmarksIgnoreFolderList: [''],
      searchEngineChoices: [
        {
          name: '',
          urlPrefix: '',
        },
      ],
    })

    expect(result.valid).toBe(false)
    expect(result.errors.some((error) => error.includes('must have length >= 1'))).toBe(true)
  })

  test('accepts valid nested objects', async () => {
    const result = await validateOptions({
      uFuzzyOptions: {
        intraMode: 1,
        intraIns: 1,
        intraSub: 1,
        intraTrn: 1,
        intraDel: 1,
      },
    })

    expect(result).toEqual({ valid: true, errors: [] })
  })

  test('rejects unknown properties', async () => {
    const result = await validateOptions({
      unknownOption: true,
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('unknownOption is not allowed')
  })

  test('reports multiple validation errors', async () => {
    const result = await validateOptions({
      searchMaxResults: 0,
      searchFuzzyness: 2,
      searchStrategy: 'invalid',
      unknownOption: true,
      bookmarkColor: 'invalid-color',
    })

    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(1)
    expect(result.errors).toContain('searchMaxResults must be >= 1')
    expect(result.errors).toContain('searchFuzzyness must be <= 1')
    expect(result.errors).toContain('searchStrategy must be one of precise, fuzzy')
    expect(result.errors).toContain('unknownOption is not allowed')
    expect(result.errors).toContain('bookmarkColor must match pattern ^#([0-9a-fA-F]{3}){1,2}$')
  })

  test('accepts string alias as array or string', async () => {
    const result1 = await validateOptions({
      customSearchEngines: [
        {
          alias: 'g',
          name: 'Google',
          urlPrefix: 'https://www.google.com/search?q=$s',
        },
      ],
    })

    const result2 = await validateOptions({
      customSearchEngines: [
        {
          alias: ['g', 'google'],
          name: 'Google',
          urlPrefix: 'https://www.google.com/search?q=$s',
        },
      ],
    })

    expect(result1).toEqual({ valid: true, errors: [] })
    expect(result2).toEqual({ valid: true, errors: [] })
  })

  test('accepts zero values where allowed', async () => {
    const result = await validateOptions({
      historyMaxItems: 0,
      maxRecentTabsToShow: 0,
      scoreMinScore: 0,
      titleLengthRestrictionForUrls: 0,
    })

    expect(result).toEqual({ valid: true, errors: [] })
  })
})
