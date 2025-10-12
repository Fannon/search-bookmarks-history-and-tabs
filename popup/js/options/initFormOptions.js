import { printError } from '../helper/utils.js'
import { browserApi } from '../helper/browserApi.js'
import { defaultOptions, setUserOptions } from '../model/options.js'

const ext = {
  opts: {},
  dom: {},
  browserApi,
  initialized: false,
}

window.ext = ext

document.addEventListener('DOMContentLoaded', () => {
  initializeOptions().catch((error) => {
    printError(error, 'Could not initialize options view.')
  })
})

async function initializeOptions() {
  const container = document.getElementById('options-app')
  if (!container) {
    throw new Error('Options root element #options-app not found')
  }

  const [{ optionsSchema, uiSchema }, formStateModule, { renderOptionsForm }, validationModule] = await Promise.all([
    import('./optionsSchema.js'),
    import('./formState.js'),
    import('./renderForm.js'),
    import('./validation.js'),
  ])

  const state = await formStateModule.createFormState(defaultOptions)
  let validationErrors = new Map()
  const sectionState = {}
  let yamlLoaderPromise = null

  const handlers = {
    onFieldChange: handleFieldChange,
    onResetField: handleResetField,
    onAddItem: handleAddItem,
    onRemoveItem: handleRemoveItem,
    onToggleSection: handleToggleSection,
    onResetAll: handleResetAll,
    onSubmit: handleSubmit,
    onDownload: handleDownloadOverrides,
    onFocus: focusPath,
  }

  render()
  ext.initialized = true

  function render(focusTarget) {
    renderOptionsForm({
      container,
      schema: optionsSchema,
      uiSchema,
      state,
      errors: validationErrors,
      customizedCount: formStateModule.customizedCount(state),
      sectionState,
      isCustomized: (path) => formStateModule.isCustomized(state, path),
      handlers,
    })

    if (focusTarget) {
      window.requestAnimationFrame(() => focusPath(focusTarget))
    }
  }

  function focusPath(path) {
    const field = container.querySelector(`[data-path="${path}"]`)
    if (!field) {
      return
    }
    const focusable = field.querySelector('input, select, textarea, button')
    if (focusable) {
      focusable.focus()
    }
  }

  function handleToggleSection(sectionId, collapsed) {
    sectionState[sectionId] = collapsed
    render()
  }

  function handleFieldChange(path, value) {
    formStateModule.updateField(state, path, value)
    clearValidationErrorsForPath(path)
    render(path.join('.'))
  }

  function handleResetField(path) {
    formStateModule.resetField(state, path)
    clearValidationErrorsForPath(path)
    render(path.join('.'))
  }

  function handleResetAll() {
    formStateModule.resetAll(state)
    validationErrors = new Map()
    render()
  }

  function handleAddItem(path, item) {
    formStateModule.appendItem(state, path, item)
    clearValidationErrorsForPath(path)
    render(path.join('.'))
  }

  function handleRemoveItem(path, index) {
    formStateModule.removeItem(state, path, index)
    clearValidationErrorsForPath(path)
    render(path.join('.'))
  }

  async function handleSubmit() {
    const { validateOptions } = validationModule
    const validationResult = validateOptions(optionsSchema, state.formData)
    validationErrors = mapErrors(validationResult)

    if (validationErrors.size > 0) {
      render()
      return
    }

    try {
      const overrides = formStateModule.getOverrides(state)
      await setUserOptions(overrides)
      window.location.href = './index.html#search/'
    } catch (error) {
      printError(error, 'Could not save user options.')
    }
  }

  async function handleDownloadOverrides() {
    try {
      const overrides = formStateModule.getOverrides(state)
      const yaml = await loadYaml()
      const content = yaml.dump(overrides)
      const blob = new Blob([content], { type: 'text/yaml' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'user-options-overrides.yml'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      printError(error, 'Could not export overrides as YAML.')
    }
  }

  function loadYaml() {
    if (window.jsyaml) {
      return Promise.resolve(window.jsyaml)
    }
    if (!yamlLoaderPromise) {
      yamlLoaderPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script')
        script.src = './lib/js-yaml.min.js'
        script.defer = true
        script.onload = () => resolve(window.jsyaml)
        script.onerror = () => reject(new Error('Failed to load js-yaml library'))
        document.head.appendChild(script)
      })
    }
    return yamlLoaderPromise
  }

  function clearValidationErrorsForPath(path) {
    const key = path.join('.')
    for (const existingKey of Array.from(validationErrors.keys())) {
      if (existingKey === key || existingKey.startsWith(`${key}.`)) {
        validationErrors.delete(existingKey)
      }
    }
  }

  function mapErrors(validationResult) {
    if (validationResult.valid) {
      return new Map()
    }
    const map = new Map()
    for (const error of validationResult.errors) {
      const path = error.path || ''
      if (!map.has(path)) {
        map.set(path, [])
      }
      map.get(path).push(error.message)
    }
    return map
  }
}
