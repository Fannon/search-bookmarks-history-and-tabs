/**
 * ✅ Covered behaviors: loading, saving, and resetting user options via the edit options view.
 * ⚠️ Known gaps: module-scoped isInitialized may prevent re-initialization across popup sessions, and location redirects are not asserted (jsdom limitation).
 * 🐞 Added BUG tests: none.
 */

import { jest } from '@jest/globals'

function setupDom() {
  document.body.innerHTML = `
    <textarea id="config"></textarea>
    <button id="opt-save"></button>
    <button id="opt-reset"></button>
    <div id="error-message" style="display:none"></div>
  `
}

function setupOptionsFormDom() {
  document.body.innerHTML = `
    <section data-manager-panel="options">
      <div data-page-status></div>
      <form id="options-form"></form>
      <textarea id="config"></textarea>
      <button id="opt-save"></button>
      <button id="opt-reset"></button>
      <div id="error-message" style="display:none"></div>
    </section>
  `
}

function createJsonYamlMocks() {
  return {
    dump: jest.fn((value) => {
      if (!value || Object.keys(value).length === 0) return '{}'
      return JSON.stringify(value)
    }),
    load: jest.fn((value) => {
      if (!value) return undefined
      return JSON.parse(value)
    }),
  }
}

async function loadEditOptionsView({
  userOptions = {},
  getUserOptionsImpl,
  dumpImpl,
  loadImpl,
  setUserOptionsImpl,
  validateOptionsImpl,
} = {}) {
  jest.resetModules()

  const getUserOptions = getUserOptionsImpl || jest.fn(() => Promise.resolve(userOptions))
  const setUserOptions =
    setUserOptionsImpl ||
    jest.fn(() => {
      return Promise.resolve()
    })

  const validateOptions =
    validateOptionsImpl ||
    jest.fn(() => {
      return Promise.resolve({ valid: true, errors: [] })
    })

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

  jest.unstable_mockModule('../../model/optionsStorage.js', () => ({
    getUserOptions,
    setUserOptions,
  }))

  jest.unstable_mockModule('../../model/validateOptions.js', () => ({
    validateOptions,
  }))

  const module = await import('../editOptionsView.js')

  return {
    module,
    mocks: {
      getUserOptions,
      setUserOptions,
      validateOptions,
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

  it('initOptions preserves edits made before async options finish loading', async () => {
    setupDom()
    let resolveUserOptions
    const userOptionsPromise = new Promise((resolve) => {
      resolveUserOptions = resolve
    })
    const getUserOptions = jest.fn(() => userOptionsPromise)
    const { module, mocks } = await loadEditOptionsView({
      getUserOptionsImpl: getUserOptions,
      dumpImpl: jest.fn(() => 'searchMaxResults: 24'),
    })

    const initPromise = module.initOptions()
    document.getElementById('config').value = 'searchMaxResults: "not-a-number"'
    resolveUserOptions({ searchMaxResults: 24 })
    await initPromise

    expect(mocks.dump).toHaveBeenCalledWith({ searchMaxResults: 24 })
    expect(document.getElementById('config').value).toBe('searchMaxResults: "not-a-number"')
  })

  it('saveOptions validates, normalizes YAML, persists options, and navigates back to search', async () => {
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
    expect(mocks.validateOptions).toHaveBeenCalledWith({ theme: 'dark' })
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

    const errorMessageEl = document.getElementById('error-message')
    expect(mocks.setUserOptions).not.toHaveBeenCalled()
    expect(errorMessageEl.style.display).toBe('flex')
    expect(errorMessageEl.textContent).toContain('Invalid Options')
    expect(errorMessageEl.textContent).toContain('bad input')
    expect(errorMessageEl.textContent).toContain('DISMISS')
    expect(errorSpy).toHaveBeenCalledWith(error)

    errorSpy.mockRestore()
  })

  it('saveOptions displays schema validation errors when validateOptions returns invalid', async () => {
    setupDom()
    const validateOptionsImpl = jest.fn(() =>
      Promise.resolve({
        valid: false,
        errors: ['searchMaxResults must be >= 1', 'displayScore must be boolean'],
      }),
    )
    const { module, mocks } = await loadEditOptionsView({
      userOptions: {},
      dumpImpl: jest.fn(() => '{}'),
      validateOptionsImpl,
    })
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    await module.initOptions()
    document.getElementById('config').value = 'searchMaxResults: 0'

    document.getElementById('opt-save').dispatchEvent(new MouseEvent('click'))
    await Promise.resolve()

    const errorMessageEl = document.getElementById('error-message')
    expect(mocks.validateOptions).toHaveBeenCalled()
    expect(mocks.setUserOptions).not.toHaveBeenCalled() // Should NOT call setUserOptions when validation fails
    expect(errorMessageEl.style.display).toBe('flex')
    expect(errorMessageEl.textContent).toContain('Invalid Options')
    expect(errorMessageEl.textContent).toContain('• searchMaxResults must be >= 1')
    expect(errorMessageEl.textContent).toContain('• displayScore must be boolean')
    expect(errorMessageEl.textContent).toContain('DISMISS')

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

  it('edits simple string arrays with inline rows', async () => {
    setupOptionsFormDom()
    const yaml = createJsonYamlMocks()
    const { module } = await loadEditOptionsView({
      userOptions: {},
      dumpImpl: yaml.dump,
      loadImpl: yaml.load,
    })

    await module.initOptions()

    const row = document.querySelector('[data-option-key="bookmarksIgnoreFolderList"]')
    row.querySelector('[data-option-enabled]').click()
    row.querySelector('[data-option-add-array-item]').click()
    const input = row.querySelector('[data-array-value]')
    input.value = 'Bookmarks/Archive'
    input.dispatchEvent(new Event('input', { bubbles: true }))

    expect(JSON.parse(document.getElementById('config').value)).toEqual({
      bookmarksIgnoreFolderList: ['Bookmarks/Archive'],
    })
  })

  it('edits searchEngineChoices with inline rows', async () => {
    setupOptionsFormDom()
    const yaml = createJsonYamlMocks()
    const { module } = await loadEditOptionsView({
      userOptions: {},
      dumpImpl: yaml.dump,
      loadImpl: yaml.load,
    })

    await module.initOptions()

    const row = document.querySelector('[data-option-key="searchEngineChoices"]')
    row.querySelector('[data-option-enabled]').click()
    row.querySelector('[data-option-add-array-item]').click()
    const lastItem = row.querySelector('[data-option-array-item]:last-child')
    lastItem.querySelector('[data-array-field="name"]').value = 'Docs'
    lastItem.querySelector('[data-array-field="urlPrefix"]').value = 'https://docs.example/search?q=$s'
    lastItem.querySelector('[data-array-field="urlPrefix"]').dispatchEvent(new Event('input', { bubbles: true }))

    expect(JSON.parse(document.getElementById('config').value)).toEqual({
      searchEngineChoices: [
        {
          name: 'Google',
          urlPrefix: 'https://www.google.com/search?q=$s',
        },
        {
          name: 'Docs',
          urlPrefix: 'https://docs.example/search?q=$s',
        },
      ],
    })
  })

  it('saveOptions shows REMOVE UNKNOWN OPTIONS button for unknown options, and it works', async () => {
    setupDom()
    const validateOptionsImpl = jest.fn(() =>
      Promise.resolve({
        valid: false,
        errors: ['Unknown option: "unknownKey"'],
      }),
    )
    const { module, mocks } = await loadEditOptionsView({
      userOptions: {},
      dumpImpl: jest.fn(() => 'knownKey: value'),
      loadImpl: jest.fn(() => ({ knownKey: 'value' })),
      validateOptionsImpl,
    })

    await module.initOptions()
    document.getElementById('config').value = 'knownKey: value\nunknownKey: extra'

    // First save attempt shows the error with clean button
    document.getElementById('opt-save').dispatchEvent(new MouseEvent('click'))
    await Promise.resolve()

    const errorMessageEl = document.getElementById('error-message')
    expect(errorMessageEl.textContent).toContain('REMOVE UNKNOWN OPTIONS')

    // Click REMOVE UNKNOWN OPTIONS
    const btnClean = document.getElementById('btn-clean')
    expect(btnClean).not.toBeNull()

    // Second validate call for cleaning should return valid
    mocks.validateOptions.mockImplementationOnce(() => Promise.resolve({ valid: true, errors: [] }))

    btnClean.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    // It should have cleaned the text but NOT called setUserOptions (user must save manually)
    expect(mocks.setUserOptions).not.toHaveBeenCalled()
    expect(errorMessageEl.style.display).toBe('none')
    expect(document.getElementById('config').value).toBe('knownKey: value')
  })

  it.failing('REMOVE UNKNOWN OPTIONS also strips nested unknown properties', async () => {
    setupDom()
    const nestedOptions = {
      customSearchEngines: [
        {
          alias: 'gh',
          name: 'GitHub',
          urlPrefix: 'https://github.com/search?q=$s',
          extra: 'remove-me',
        },
      ],
    }

    const { module } = await loadEditOptionsView({
      userOptions: {},
      dumpImpl: jest.fn((value) => JSON.stringify(value, null, 2)),
      loadImpl: jest.fn(() => nestedOptions),
      validateOptionsImpl: jest.fn(() =>
        Promise.resolve({
          valid: false,
          errors: ['Unknown option: "customSearchEngines[0].extra"'],
        }),
      ),
    })

    await module.initOptions()
    document.getElementById('config').value = JSON.stringify(nestedOptions, null, 2)

    document.getElementById('opt-save').dispatchEvent(new MouseEvent('click'))
    await Promise.resolve()

    const btnClean = document.getElementById('btn-clean')
    expect(btnClean).not.toBeNull()

    btnClean.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await Promise.resolve()

    expect(document.getElementById('config').value).not.toContain('remove-me')
  })
})
