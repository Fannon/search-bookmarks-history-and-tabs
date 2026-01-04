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

import { getUserOptions, setUserOptions } from '../model/options.js'
import { validateOptions } from '../model/validateOptions.js'

/**
 * Initialize the options editor view by loading and displaying user overrides.
 *
 * @returns {Promise<void>}
 */
export async function initOptions() {
  if (!optionsSchema) {
    optionsSchema = (await import('../../json/options.schema.json')).default
  }
  const userOptions = await getUserOptions()
  const userOptionsYaml = window.jsyaml.dump(userOptions)

  if (userOptionsYaml.trim() === '{}') {
    document.getElementById('config').value = ''
  } else {
    document.getElementById('config').value = userOptionsYaml
  }

  // Ensure event listeners are only attached once to prevent duplicates
  if (!isInitialized) {
    document.getElementById('opt-reset').addEventListener('click', resetOptions)
    document.getElementById('opt-save').addEventListener('click', saveOptions)

    // Hide error overlay when focusing the textarea
    document.getElementById('config').addEventListener('focus', hideErrors)

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

    document.getElementById('config').value = window.jsyaml.dump(cleanOptions)
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

    document.getElementById('config').value = window.jsyaml.dump(userOptions)
    await setUserOptions(userOptions)

    // Clear any previous error messages
    hideErrors()
  } catch (e) {
    console.error(e)
    showErrorMessage(e)
    return
  }

  try {
    window.location.href = './index.html#search/'
  } catch (navigationError) {
    console.warn('Navigation to search view not supported in this environment.', navigationError)
  }
}

/**
 * Clear user overrides, reverting to defaults on next load.
 */
async function resetOptions() {
  document.getElementById('config').value = ''
  hideErrors()
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
