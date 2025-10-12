import { describe, expect, it } from '@jest/globals'

import { optionsSchema } from '../optionsSchema.js'
import { validateOptions } from '../validation.js'
import { defaultOptions } from '../../model/options.js'

describe('options validation', () => {
  it('accepts default options', () => {
    const result = validateOptions(optionsSchema, defaultOptions)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects invalid enum values', () => {
    const result = validateOptions(optionsSchema, {
      ...defaultOptions,
      searchStrategy: 'invalid-mode',
    })
    expect(result.valid).toBe(false)
    const paths = result.errors.map((error) => error.path)
    expect(paths).toContain('searchStrategy')
  })

  it('enforces custom zero-or-minimum rule', () => {
    const result = validateOptions(optionsSchema, {
      ...defaultOptions,
      maxRecentTabsToShow: 2,
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'maxRecentTabsToShow',
          message: expect.stringContaining('0 or at least'),
        }),
      ]),
    )
  })
})
