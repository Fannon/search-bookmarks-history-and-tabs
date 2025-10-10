import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import { flushPromises, clearTestExt } from './testUtils.js'

describe('initOptions entry point', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    document.body.innerHTML = '<div id="error-list"></div>'
    clearTestExt()
  })

  afterEach(() => {
    clearTestExt()
  })

  test('exports ext namespace and initializes options view', async () => {
    const initOptionsMock = jest.fn(() => Promise.resolve())

    await jest.unstable_mockModule('../view/editOptionsView.js', () => ({
      __esModule: true,
      initOptions: initOptionsMock,
    }))
    await jest.unstable_mockModule('../helper/utils.js', () => ({
      __esModule: true,
      printError: jest.fn(),
    }))
    const browserApi = { storage: { sync: {} } }
    await jest.unstable_mockModule('../helper/browserApi.js', () => ({
      __esModule: true,
      browserApi,
    }))

    const module = await import('../initOptions.js')
    await flushPromises()

    expect(module.ext.browserApi).toBe(browserApi)
    expect(window.ext).toBe(module.ext)
    expect(initOptionsMock).toHaveBeenCalledTimes(1)
  })

  test('logs initialization errors via printError', async () => {
    const error = new Error('boom')
    const printError = jest.fn()

    await jest.unstable_mockModule('../view/editOptionsView.js', () => ({
      __esModule: true,
      initOptions: jest.fn(() => Promise.reject(error)),
    }))
    await jest.unstable_mockModule('../helper/utils.js', () => ({
      __esModule: true,
      printError,
    }))
    await jest.unstable_mockModule('../helper/browserApi.js', () => ({
      __esModule: true,
      browserApi: {},
    }))

    await import('../initOptions.js')
    await flushPromises()

    expect(printError).toHaveBeenCalledWith(error, 'Could not initialize options view.')
  })
})
