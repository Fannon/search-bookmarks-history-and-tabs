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

  test('rejects values outside numeric bounds', async () => {
    const result = await validateOptions({
      searchMaxResults: 0,
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('searchMaxResults must be >= 1')
  })

  test('rejects unknown properties', async () => {
    const result = await validateOptions({
      unknownOption: true,
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('unknownOption is not allowed')
  })
})
