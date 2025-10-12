import { describe, expect, it, beforeEach, jest } from '@jest/globals'

const getUserOptionsMock = jest.fn()

jest.unstable_mockModule('../../model/options.js', () => ({
  getUserOptions: getUserOptionsMock,
}))

const formStateModule = await import('../formState.js')

describe('formState utilities', () => {
  const defaults = {
    toggle: false,
    count: 3,
    tags: [],
    items: [
      {
        name: 'Default',
        url: 'https://example.com?q=$s',
      },
    ],
  }

  beforeEach(() => {
    getUserOptionsMock.mockReset()
  })

  it('merges defaults with overrides and tracks customized fields', async () => {
    getUserOptionsMock.mockResolvedValueOnce({ count: 10 })
    const state = await formStateModule.createFormState(defaults)

    expect(state.formData.count).toBe(10)
    expect(formStateModule.isCustomized(state, ['count'])).toBe(true)

    const overrides = formStateModule.getOverrides(state)
    expect(overrides).toEqual({ count: 10 })
  })

  it('updates and resets fields', async () => {
    getUserOptionsMock.mockResolvedValueOnce({})
    const state = await formStateModule.createFormState(defaults)

    formStateModule.updateField(state, ['toggle'], true)
    expect(formStateModule.getOverrides(state)).toEqual({ toggle: true })
    expect(formStateModule.isCustomized(state, ['toggle'])).toBe(true)

    formStateModule.resetField(state, ['toggle'])
    expect(formStateModule.isCustomized(state, ['toggle'])).toBe(false)
    expect(formStateModule.getOverrides(state)).toEqual({})
  })

  it('appends and removes list items', async () => {
    getUserOptionsMock.mockResolvedValueOnce({})
    const state = await formStateModule.createFormState(defaults)

    formStateModule.appendItem(state, ['tags'], 'work')
    formStateModule.appendItem(state, ['tags'], 'personal')

    expect(state.formData.tags).toEqual(['work', 'personal'])
    expect(formStateModule.isCustomized(state, ['tags'])).toBe(true)

    formStateModule.removeItem(state, ['tags'], 0)
    expect(state.formData.tags).toEqual(['personal'])
  })

  it('resets state to defaults', async () => {
    getUserOptionsMock.mockResolvedValueOnce({ count: 7 })
    const state = await formStateModule.createFormState(defaults)

    formStateModule.resetAll(state)
    expect(state.formData).toEqual(defaults)
    expect(formStateModule.customizedCount(state)).toBe(0)
  })
})
