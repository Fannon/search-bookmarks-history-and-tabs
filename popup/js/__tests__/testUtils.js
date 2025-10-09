export function flushPromises() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

export function createTestExt(overrides = {}) {
  const base = {
    opts: {},
    model: {},
    index: { taxonomy: {} },
    dom: {},
    browserApi: {},
    initialized: false,
  }
  const ext = {
    ...base,
    ...overrides,
    opts: { ...base.opts, ...(overrides.opts || {}) },
    model: { ...base.model, ...(overrides.model || {}) },
    index: {
      taxonomy: { ...(base.index.taxonomy || {}), ...((overrides.index && overrides.index.taxonomy) || {}) },
    },
    dom: { ...base.dom, ...(overrides.dom || {}) },
    browserApi: { ...base.browserApi, ...(overrides.browserApi || {}) },
  }
  global.ext = ext
  if (typeof window !== 'undefined') {
    window.ext = ext
    if (typeof document !== 'undefined' && !document.getElementById('error-list')) {
      const errorContainer = document.createElement('div')
      errorContainer.id = 'error-list'
      errorContainer.style = 'display: none;'
      document.body.appendChild(errorContainer)
    }
  }
  return ext
}
