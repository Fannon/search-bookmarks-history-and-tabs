/**
 * ✅ Covered behaviors: loading, saving, and resetting user options via the edit options view.
 * ⚠️ Known gaps: repeated initOptions calls may register duplicate listeners and location redirects are not asserted (jsdom limitation).
 * 🐞 Added BUG tests: none.
 */

import { jest } from '@jest/globals'

function setupDom() {
  document.body.innerHTML = `
    <textarea id="config"></textarea>
    <button id="opt-save"></button>
    <button id="opt-reset"></button>
    <div id="err-msg" style="display:none"></div>
  `
}

async function loadEditOptionsView({ userOptions = {}, dumpImpl, loadImpl } = {}) {
  jest.resetModules()

  const getUserOptions = jest.fn(() => Promise.resolve(userOptions))
  const setUserOptions = jest.fn(() => Promise.resolve())

  const dumpMock =
    dumpImpl ||
    jest.fn((value) => {
      if (!value || Object.keys(value).length === 0) {
        return '{}'
      }
      return JSON.stringify(value)
    })
  const loadMock =
    loadImpl ||
    jest.fn((yaml) => {
      if (yaml === 'invalid') {
        throw new Error('Invalid YAML')
      }
      return { parsed: yaml }
    })

  window.jsyaml = {
    dump: dumpMock,
    load: loadMock,
  }

  jest.unstable_mockModule('../../model/options.js', () => ({
    getUserOptions,
    setUserOptions,
  }))

  const module = await import('../editOptionsView.js')

  return {
    module,
    mocks: {
      getUserOptions,
      setUserOptions,
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
      dumpImpl: jest.fn(() => 'theme: dark'),
    })

    await module.initOptions()

    expect(mocks.getUserOptions).toHaveBeenCalledTimes(1)
    expect(mocks.dump).toHaveBeenCalledWith({ theme: 'dark' })
    expect(document.getElementById('config').value).toBe('theme: dark')
  })

  it('initOptions clears textarea when serialized options equal an empty object', async () => {
    setupDom()
    const dumpImpl = jest.fn(() => '{}')
    const { module, mocks } = await loadEditOptionsView({
      userOptions: {},
      dumpImpl,
    })

    await module.initOptions()

    expect(mocks.dump).toHaveBeenCalledWith({})
    expect(document.getElementById('config').value).toBe('')
  })

  it('saveOptions normalizes YAML, persists options, and navigates back to search', async () => {
    setupDom()
    const loadImpl = jest.fn(() => ({ theme: 'dark' }))
    const dumpImpl = jest
      .fn()
      .mockReturnValueOnce('theme: dark') // initOptions call
      .mockReturnValue('normalized: dark') // saveOptions call
    const { module, mocks } = await loadEditOptionsView({
      userOptions: { theme: 'dark' },
      dumpImpl,
      loadImpl,
    })

    await module.initOptions()
    document.getElementById('config').value = 'theme: dark'

    document.getElementById('opt-save').dispatchEvent(new MouseEvent('click'))
    await Promise.resolve()

    expect(mocks.load).toHaveBeenCalledWith('theme: dark')
    expect(mocks.setUserOptions).toHaveBeenCalledWith({ theme: 'dark' })
    expect(document.getElementById('config').value).toBe('normalized: dark')
  })

  it('saveOptions displays an error message when YAML parsing fails', async () => {
    setupDom()
    const error = new Error('bad input')
    const loadImpl = jest.fn(() => {
      throw error
    })
    const { module, mocks } = await loadEditOptionsView({
      userOptions: {},
      dumpImpl: jest.fn(() => '{}'),
      loadImpl,
    })
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    await module.initOptions()
    document.getElementById('config').value = 'invalid yaml'

    document.getElementById('opt-save').dispatchEvent(new MouseEvent('click'))
    await Promise.resolve()

    const errorMessageEl = document.getElementById('err-msg')
    expect(mocks.setUserOptions).not.toHaveBeenCalled()
    expect(errorMessageEl.getAttribute('style')).toBe('')
    expect(errorMessageEl.innerText).toBe('Invalid bad input')
    expect(errorSpy).toHaveBeenCalledWith(error)

    errorSpy.mockRestore()
  })

  it('resetOptions clears the textarea value', async () => {
    setupDom()
    const { module } = await loadEditOptionsView({
      userOptions: {},
      dumpImpl: jest.fn(() => '{}'),
    })

    await module.initOptions()
    const input = document.getElementById('config')
    input.value = 'some config'

    document.getElementById('opt-reset').dispatchEvent(new MouseEvent('click'))
    await Promise.resolve()

    expect(input.value).toBe('')
  })
})
