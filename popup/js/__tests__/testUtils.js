import { defaultOptions } from '../model/options.js'

export function flushPromises() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

export function createTestExt(overrides = {}) {
  const base = {
    opts: { ...defaultOptions },
    model: {},
    index: { taxonomy: {} },
    dom: {},
    browserApi: {},
    initialized: false,
    searchCache: new Map()
  }
  const ext = {
    ...base,
    ...overrides,
    opts: { ...base.opts, ...(overrides.opts || {}) },
    model: { ...base.model, ...(overrides.model || {}) },
    index: {
      taxonomy: {
        ...(base.index.taxonomy || {}),
        ...(overrides.index?.taxonomy || {})
      }
    },
    dom: { ...base.dom, ...(overrides.dom || {}) },
    browserApi: { ...base.browserApi, ...(overrides.browserApi || {}) }
  }
  global.ext = ext
  if (typeof window !== 'undefined') {
    window.ext = ext
    if (
      typeof document !== 'undefined' &&
      !document.getElementById('error-list')
    ) {
      const errorContainer = document.createElement('div')
      errorContainer.id = 'error-list'
      errorContainer.style = 'display: none;'
      document.body.appendChild(errorContainer)
    }
  }
  return ext
}

export function clearTestExt() {
  // Clear any existing searchCache if it's a Map
  if (
    globalThis.ext?.searchCache &&
    typeof globalThis.ext.searchCache.clear === 'function'
  ) {
    globalThis.ext.searchCache.clear()
  }
  if (
    typeof window !== 'undefined' &&
    window.ext?.searchCache &&
    typeof window.ext.searchCache.clear === 'function'
  ) {
    window.ext.searchCache.clear()
  }

  delete globalThis.ext
  if (typeof window !== 'undefined') {
    delete window.ext
  }

  // Note: fuzzy search state should be reset in individual test cleanup
}
