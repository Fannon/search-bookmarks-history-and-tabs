/**
 * @file Powers the options editor view.
 *
 * Responsibilities:
 * - Load persisted configuration, present it as YAML, and keep the textarea in sync with stored overrides.
 * - Validate user edits against the JSON schema, surface errors inline, and persist accepted changes.
 * - Provide reset/save controls and navigate back to the search view so tweaks can be tested immediately.
 */

let optionsSchema
let isInitialized = false
let redirectAfterSave = './index.html#search/'
let isSyncingOptions = false

import { browserApi } from '../helper/browserApi.js'
import { getUserOptions, setUserOptions } from '../model/optionsStorage.js'
import { validateOptions } from '../model/validateOptions.js'

const OPTION_SECTIONS = {
  search: 'Search',
  style: 'Result Colors',
  sources: 'Sources',
  display: 'Display',
  bookmarks: 'Bookmarks',
  tabs: 'Tabs',
  history: 'History',
  searchEngines: 'Search Engines',
  scores: 'Scoring',
  powerUsers: 'Power Users',
}

/**
 * Initialize the options editor view by loading and displaying user overrides.
 *
 * @returns {Promise<void>}
 */
export async function initOptions(options = {}) {
  const configEl = document.getElementById('config')
  if (!configEl) return

  redirectAfterSave = options.redirectAfterSave || redirectAfterSave
  initOptionControls()
  const initialConfigValue = configEl.value

  await ensureOptionsSchema()
  renderOptionsForm()
  const userOptions = await getUserOptions()
  const userOptionsYaml = window.jsyaml.dump(userOptions)

  if (configEl.value !== initialConfigValue) return

  setConfigYamlValue(userOptionsYaml)
  syncFormFromOptions(userOptions)
  validateCurrentOptions({ showOverlay: false })
}

function initOptionControls() {
  // Ensure event listeners are only attached once to prevent duplicates
  if (isInitialized) return

  const resetBtn = document.getElementById('opt-reset')
  const saveBtn = document.getElementById('opt-save')
  const configEl = document.getElementById('config')
  const formEl = document.getElementById('options-form')

  if (resetBtn) {
    resetBtn.addEventListener('click', (event) => {
      event.preventDefault()
      resetOptions()
    })
  }
  if (saveBtn) {
    saveBtn.addEventListener('click', (event) => {
      event.preventDefault()
      saveOptions()
    })
  }
  if (configEl) configEl.addEventListener('focus', hideErrors)
  if (configEl) configEl.addEventListener('input', syncOptionsFromYaml)
  if (formEl) formEl.addEventListener('input', syncYamlFromForm)
  if (formEl) formEl.addEventListener('change', syncYamlFromForm)
  if (formEl) formEl.addEventListener('click', handleOptionFormClick)

  // Use event delegation for the error overlay buttons
  const errorMessageEl = document.getElementById('error-message')
  if (errorMessageEl) {
    errorMessageEl.addEventListener('click', (ev) => {
      if (ev.target.id === 'btn-dismiss') {
        hideErrors()
      } else if (ev.target.id === 'btn-clean') {
        ev.stopPropagation()
        removeUnknownOptions()
      }
    })
  }

  isInitialized = true
}

async function ensureOptionsSchema() {
  if (optionsSchema) return

  try {
    optionsSchema = (await import('../../json/options.schema.json', { with: { type: 'json' } })).default
  } catch {
    // Fallback for browsers that don't support import attributes (e.g., Firefox < 128)
    const response = await fetch('./json/options.schema.json')
    optionsSchema = await response.json()
  }
}

function renderOptionsForm() {
  const formEl = document.getElementById('options-form')
  if (!formEl || formEl.dataset.rendered === 'true') return

  const groupedOptions = getGroupedOptionEntries()
  formEl.innerHTML = Object.entries(groupedOptions)
    .map(([section, entries]) => {
      return `
        <section class="options-section-group">
          <h4 class="options-section-title">${escapeHtml(OPTION_SECTIONS[section] || section)}</h4>
          <div class="options-section">
            ${entries.map(([key, schema]) => renderOptionRow(key, schema)).join('')}
          </div>
        </section>
      `
    })
    .join('')
  formEl.dataset.rendered = 'true'
}

function getGroupedOptionEntries() {
  const grouped = {}
  const properties = optionsSchema?.properties || {}

  for (const entry of Object.entries(properties)) {
    const [key, schema] = entry
    if (key === '$schema') continue

    const section = schema['x-ui-section'] || 'powerUsers'
    grouped[section] ||= []
    grouped[section].push(entry)
  }

  return grouped
}

function renderOptionRow(key, schema) {
  return `
    <section class="option-row" data-option-key="${escapeHtml(key)}">
      <label class="option-enabled">
        <input type="checkbox" data-option-enabled />
        <span>Customize</span>
      </label>
      <div class="option-body">
        <label class="option-label" for="option-${escapeHtml(key)}">${escapeHtml(key)}</label>
        ${renderOptionInput(key, schema)}
        <p class="option-description">${escapeHtml(schema.description || '')}</p>
        <p class="option-default">Default: <code>${escapeHtml(formatYamlInline(schema.default))}</code></p>
        <p class="option-error" data-option-error aria-live="polite"></p>
      </div>
    </section>
  `
}

function renderOptionInput(key, schema) {
  const type = getSimpleSchemaType(schema)
  const id = `option-${escapeHtml(key)}`
  const disabled = 'disabled data-option-input'

  if (schema.enum) {
    return `
      <select id="${id}" ${disabled}>
        ${schema.enum.map((value) => `<option value="${escapeHtml(String(value))}">${escapeHtml(String(value))}</option>`).join('')}
      </select>
    `
  }

  if (type === 'boolean') {
    return `<label class="option-check"><input id="${id}" type="checkbox" ${disabled} /> <span>Enabled</span></label>`
  }

  if (type === 'integer' || type === 'number') {
    const min = schema.minimum !== undefined ? ` min="${escapeHtml(String(schema.minimum))}"` : ''
    const max = schema.maximum !== undefined ? ` max="${escapeHtml(String(schema.maximum))}"` : ''
    const step = type === 'integer' ? '1' : '0.1'
    return `<input id="${id}" type="number" step="${step}"${min}${max} ${disabled} />`
  }

  if (type === 'array' || type === 'object') {
    if (isStringArraySchema(schema)) {
      return renderStringArrayInput(id)
    }

    if (key === 'searchEngineChoices') {
      return renderSearchEngineChoicesInput(id)
    }

    return `<textarea id="${id}" rows="5" ${disabled}></textarea>`
  }

  if (schema.pattern?.includes('[0-9a-fA-F]')) {
    return `<input id="${id}" type="color" ${disabled} />`
  }

  return `<input id="${id}" type="text" ${disabled} />`
}

function renderStringArrayInput(id) {
  return `
    <div id="${id}" class="option-list-editor" data-option-input data-option-array-kind="string" aria-disabled="true">
      <div data-option-list-items></div>
      <button class="text-button" type="button" data-option-add-array-item disabled>Add item</button>
    </div>
  `
}

function renderSearchEngineChoicesInput(id) {
  return `
    <div id="${id}" class="option-list-editor" data-option-input data-option-array-kind="search-engine" aria-disabled="true">
      <div data-option-list-items></div>
      <button class="text-button" type="button" data-option-add-array-item disabled>Add search engine</button>
    </div>
  `
}

function isStringArraySchema(schema) {
  return getSimpleSchemaType(schema) === 'array' && schema.items?.type === 'string'
}

function getSimpleSchemaType(schema) {
  if (schema.type) {
    return Array.isArray(schema.type) ? schema.type[0] : schema.type
  }

  if (schema.oneOf?.length) {
    return getSimpleSchemaType(schema.oneOf[0])
  }

  if (schema.anyOf?.length) {
    return getSimpleSchemaType(schema.anyOf[0])
  }

  return 'string'
}

function handleOptionFormClick(event) {
  const addButton = event.target.closest?.('[data-option-add-array-item]')
  const removeButton = event.target.closest?.('[data-option-remove-array-item]')

  if (!addButton && !removeButton) return

  event.preventDefault()
  const row = event.target.closest('[data-option-key]')
  const editor = row?.querySelector('[data-option-array-kind]')
  if (!row || !editor || editor.getAttribute('aria-disabled') === 'true') return

  if (addButton) {
    addOptionArrayItem(editor, getBlankOptionArrayItem(editor.dataset.optionArrayKind))
  } else {
    removeButton.closest('[data-option-array-item]')?.remove()
  }

  syncYamlFromForm(event)
}

function getBlankOptionArrayItem(kind) {
  if (kind === 'search-engine') return { name: '', urlPrefix: '' }
  return ''
}

function addOptionArrayItem(editor, value = '') {
  const itemsEl = editor.querySelector('[data-option-list-items]')
  if (!itemsEl) return

  if (editor.dataset.optionArrayKind === 'search-engine') {
    itemsEl.insertAdjacentHTML('beforeend', renderSearchEngineChoiceItem(value))
    return
  }

  itemsEl.insertAdjacentHTML('beforeend', renderStringArrayItem(value))
}

function renderStringArrayItem(value = '') {
  return `
    <div class="option-list-item" data-option-array-item>
      <input type="text" value="${escapeHtml(value)}" data-array-value />
      <button class="text-button" type="button" data-option-remove-array-item>Remove</button>
    </div>
  `
}

function renderSearchEngineChoiceItem(value = {}) {
  return `
    <div class="option-list-item search-engine-choice-item" data-option-array-item>
      <label>
        <span>Name</span>
        <input type="text" value="${escapeHtml(value.name || '')}" data-array-field="name" />
      </label>
      <label>
        <span>URL Prefix</span>
        <input type="text" value="${escapeHtml(value.urlPrefix || '')}" data-array-field="urlPrefix" />
      </label>
      <button class="text-button" type="button" data-option-remove-array-item>Remove</button>
    </div>
  `
}

/**
 * Hide the error overlay
 */
function hideErrors() {
  const errorMessageEl = document.getElementById('error-message')
  if (errorMessageEl) {
    errorMessageEl.style.display = 'none'
    errorMessageEl.innerHTML = ''
  }
}

/**
 * Automatically remove properties that are not in the schema.
 */
function removeUnknownOptions() {
  const userOptionsString = document.getElementById('config').value
  try {
    const userOptions = window.jsyaml.load(userOptionsString)
    if (!userOptions || typeof userOptions !== 'object') return

    const schemaProperties = optionsSchema.properties || {}
    const cleanOptions = {}

    for (const [key, value] of Object.entries(userOptions)) {
      if (key in schemaProperties || key === '$schema') {
        cleanOptions[key] = value
      }
    }

    setConfigYaml(cleanOptions)
    syncFormFromOptions(cleanOptions)
    // Clear error overlay so user can see the cleaned YAML and save manually
    hideErrors()
  } catch (e) {
    console.error('Failed to clean options:', e)
    showErrorMessage(e)
  }
}

/**
 * Persist YAML updates back to storage and return users to the search view.
 *
 * Validates user options against the JSON schema before saving.
 * This validation is only done here (not in setUserOptions) because:
 * 1. This is where users can enter arbitrary values that need validation
 * 2. Internal code (like search strategy toggle) uses known-valid values
 * 3. Keeping validation here avoids bundling schema/validator in initSearch
 *
 * @returns {Promise<void>}
 */
async function saveOptions() {
  const userOptionsString = document.getElementById('config').value
  const _errorMessageEl = document.getElementById('error-message')

  try {
    const userOptions = window.jsyaml.load(userOptionsString)

    // Validate options against schema before saving
    const validation = await validateOptions(userOptions || {})
    if (!validation.valid) {
      const schemaError = new Error('User options do not match the required schema.')
      schemaError.validationErrors = validation.errors
      throw schemaError
    }

    setConfigYaml(userOptions || {})
    syncFormFromOptions(userOptions || {})

    // Handle optional permissions
    // Favicon permission is needed for displayFavicons
    if (userOptions?.displayFavicons === true && browserApi.permissions) {
      const granted = await browserApi.permissions.request({ permissions: ['favicon'] })
      if (!granted) {
        throw new Error('The "favicon" permission is required to enable website icons.')
      }
    }

    await setUserOptions(userOptions)

    // Clear any previous error messages
    hideErrors()
  } catch (e) {
    console.error(e)
    showErrorMessage(e)
    return
  }

  try {
    window.location.href = redirectAfterSave
  } catch (navigationError) {
    console.warn('Navigation to search view not supported in this environment.', navigationError)
  }
}

/**
 * Clear user overrides, reverting to defaults on next load.
 */
async function resetOptions() {
  setConfigYaml({})
  syncFormFromOptions({})
  hideErrors()
  validateCurrentOptions({ showOverlay: false })
}

function syncOptionsFromYaml() {
  if (isSyncingOptions) return

  hideErrors()

  try {
    const options = parseConfigValue()
    syncFormFromOptions(options)
    validateCurrentOptions({ showOverlay: false })
  } catch (error) {
    showOptionsStatus(error.message, 'error')
  }
}

function syncYamlFromForm(event) {
  if (isSyncingOptions) return

  const row = event.target.closest?.('[data-option-key]')
  if (row && event.target.matches('[data-option-enabled]')) {
    setOptionRowEnabled(row, event.target.checked)
    if (event.target.checked && isOptionValueBlank(row)) {
      setOptionRowValue(row, getOptionSchema(row.dataset.optionKey).default)
    }
  }

  try {
    const options = collectOptionsFromForm()
    setConfigYaml(options)
    hideErrors()
    validateCurrentOptions({ showOverlay: false })
  } catch (error) {
    clearInlineValidation()
    const key = row?.dataset.optionKey
    if (key) {
      applyInlineValidation([`"${key}" cannot be parsed as YAML: ${error.message}`])
    }
    showOptionsStatus(error.message, 'error')
  }
}

function syncFormFromOptions(options = {}) {
  const formEl = document.getElementById('options-form')
  if (!formEl) return

  isSyncingOptions = true
  try {
    const rows = formEl.querySelectorAll('[data-option-key]')
    for (const row of rows) {
      const key = row.dataset.optionKey
      const hasValue = Object.hasOwn(options, key)
      const enabled = row.querySelector('[data-option-enabled]')
      enabled.checked = hasValue
      setOptionRowValue(row, hasValue ? options[key] : getOptionSchema(key).default)
      setOptionRowEnabled(row, hasValue)
    }
  } finally {
    isSyncingOptions = false
  }
}

function collectOptionsFromForm() {
  const formEl = document.getElementById('options-form')
  const options = {}
  if (!formEl) return options

  const rows = formEl.querySelectorAll('[data-option-key]')
  for (const row of rows) {
    const enabled = row.querySelector('[data-option-enabled]')
    if (!enabled.checked) continue

    options[row.dataset.optionKey] = getOptionRowValue(row)
  }

  return options
}

function getOptionRowValue(row) {
  const input = row.querySelector('[data-option-input]')
  const schema = getOptionSchema(row.dataset.optionKey)
  const type = getSimpleSchemaType(schema)

  if (input.dataset.optionArrayKind === 'string') return getStringArrayValue(input)
  if (input.dataset.optionArrayKind === 'search-engine') return getSearchEngineChoicesValue(input)

  if (type === 'boolean') return Boolean(input.checked)

  if (type === 'integer') {
    const parsed = Number.parseInt(input.value, 10)
    return Number.isFinite(parsed) ? parsed : input.value
  }

  if (type === 'number') {
    const parsed = Number.parseFloat(input.value)
    return Number.isFinite(parsed) ? parsed : input.value
  }

  if (type === 'array' || type === 'object') {
    return window.jsyaml.load(input.value) ?? (type === 'array' ? [] : {})
  }

  return input.value
}

function setOptionRowValue(row, value) {
  const input = row.querySelector('[data-option-input]')
  const schema = getOptionSchema(row.dataset.optionKey)
  const type = getSimpleSchemaType(schema)

  if (input.dataset.optionArrayKind) {
    setOptionArrayValue(input, Array.isArray(value) ? value : [])
  } else if (type === 'boolean') {
    input.checked = Boolean(value)
  } else if (type === 'array' || type === 'object') {
    input.value = value === undefined ? '' : window.jsyaml.dump(value).trim()
  } else {
    input.value = value ?? ''
  }
}

function isOptionValueBlank(row) {
  const input = row.querySelector('[data-option-input]')
  const schema = getOptionSchema(row.dataset.optionKey)
  if (input.dataset.optionArrayKind) return getOptionRowValue(row).length === 0
  return getSimpleSchemaType(schema) !== 'boolean' && input.value === ''
}

function setOptionRowEnabled(row, enabled) {
  row.classList.toggle('is-enabled', enabled)
  const input = row.querySelector('[data-option-input]')
  if (input.dataset.optionArrayKind) {
    input.setAttribute('aria-disabled', String(!enabled))
    const controls = input.querySelectorAll('input, button')
    for (const control of controls) control.disabled = !enabled
  } else {
    input.disabled = !enabled
  }
}

function setOptionArrayValue(editor, values = []) {
  const itemsEl = editor.querySelector('[data-option-list-items]')
  if (!itemsEl) return

  itemsEl.innerHTML = ''
  for (const value of values) addOptionArrayItem(editor, value)
}

function getStringArrayValue(editor) {
  const inputs = editor.querySelectorAll('[data-array-value]')
  const values = []
  for (const input of inputs) {
    const value = input.value.trim()
    if (value) values.push(value)
  }
  return values
}

function getSearchEngineChoicesValue(editor) {
  const items = editor.querySelectorAll('[data-option-array-item]')
  const values = []

  for (const item of items) {
    const name = item.querySelector('[data-array-field="name"]')?.value.trim() || ''
    const urlPrefix = item.querySelector('[data-array-field="urlPrefix"]')?.value.trim() || ''
    if (name || urlPrefix) values.push({ name, urlPrefix })
  }

  return values
}

function getOptionSchema(key) {
  return optionsSchema.properties[key] || {}
}

function parseConfigValue() {
  const userOptionsString = document.getElementById('config').value
  const parsed = window.jsyaml.load(userOptionsString)
  if (parsed === null || parsed === undefined) return {}
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('User options must be a valid YAML / JSON object')
  }
  return parsed
}

function setConfigYaml(options = {}) {
  setConfigYamlValue(window.jsyaml.dump(options || {}))
}

function setConfigYamlValue(yaml) {
  const configEl = document.getElementById('config')
  if (!configEl) return

  isSyncingOptions = true
  try {
    configEl.value = yaml.trim() === '{}' ? '' : yaml
  } finally {
    isSyncingOptions = false
  }
}

async function validateCurrentOptions({ showOverlay }) {
  clearInlineValidation()

  let userOptions
  try {
    userOptions = parseConfigValue()
  } catch (error) {
    showOptionsStatus(error.message, 'error')
    if (showOverlay) showErrorMessage(error)
    return false
  }

  const validation = await validateOptions(userOptions)
  if (!validation.valid) {
    applyInlineValidation(validation.errors)
    showOptionsStatus(
      `${validation.errors.length} validation issue${validation.errors.length === 1 ? '' : 's'}`,
      'error',
    )
    if (showOverlay) {
      const schemaError = new Error('User options do not match the required schema.')
      schemaError.validationErrors = validation.errors
      showErrorMessage(schemaError)
    }
    return false
  }

  showOptionsStatus('Options draft is valid', 'success')
  return true
}

function clearInlineValidation() {
  const formEl = document.getElementById('options-form')
  if (!formEl) return

  const rows = formEl.querySelectorAll('[data-option-key]')
  for (const row of rows) {
    row.classList.remove('has-error')
    const errorEl = row.querySelector('[data-option-error]')
    if (errorEl) errorEl.textContent = ''
  }
}

function applyInlineValidation(errors = []) {
  for (const error of errors) {
    const key = getErrorOptionKey(error)
    const row = key ? getOptionRow(key) : null
    if (!row) continue

    row.classList.add('has-error')
    const errorEl = row.querySelector('[data-option-error]')
    if (errorEl) errorEl.textContent = error
  }
}

function getOptionRow(key) {
  const rows = document.querySelectorAll('[data-option-key]')
  for (const row of rows) {
    if (row.dataset.optionKey === key) return row
  }
  return null
}

function getErrorOptionKey(error) {
  const unknownMatch = error.match(/Unknown option: "([^".[]+)/)
  if (unknownMatch) return unknownMatch[1]

  const quotedMatch = error.match(/"([^".[]+)/)
  return quotedMatch?.[1] || ''
}

function showOptionsStatus(message, tone = 'info') {
  const status = document.querySelector('[data-manager-panel="options"] [data-page-status]')
  if (!status) return

  status.textContent = message
  status.dataset.tone = tone
}

function formatYamlInline(value) {
  if (value === undefined) return ''
  return window.jsyaml.dump(value).trim().replace(/\n/g, ' ')
}

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Surface errors in the UI overlay.
 *
 * @param {Error} e - The error object to display.
 */
function showErrorMessage(e) {
  const errorMessageEl = document.getElementById('error-message')
  if (!errorMessageEl) return

  errorMessageEl.style.display = 'flex'

  const hasUnknownOptions =
    e && Array.isArray(e.validationErrors) && e.validationErrors.some((err) => err.includes('Unknown option'))

  let errorContent = ''
  if (e && Array.isArray(e.validationErrors) && e.validationErrors.length > 0) {
    errorContent = e.validationErrors
      .map((err) => {
        const escaped = err.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        return `• ${escaped.replace(/"([^"]+)"/g, '<code>$1</code>')}`
      })
      .join('\n')
  } else {
    const escaped = (e?.message || 'Unknown error').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    errorContent = escaped.replace(/"([^"]+)"/g, '<code>$1</code>')
  }

  errorMessageEl.innerHTML = `
    <div class="error-header">⚠️ Invalid Options</div>
    <div class="error-list">${errorContent}</div>
    <div class="error-footer">
      ${
        hasUnknownOptions ? '<button id="btn-clean" class="overlay-button primary">REMOVE UNKNOWN OPTIONS</button>' : ''
      }
      <button id="btn-dismiss" class="overlay-button">DISMISS</button>
    </div>
  `
}
