/**
 * @file Powers the options editor view.
 *
 * Responsibilities:
 * - Load persisted configuration, present it as YAML, and keep the textarea in sync with stored overrides.
 * - Validate user edits against the JSON schema, surface errors inline, and persist accepted changes.
 * - Provide reset/save controls and navigate back to the search view so tweaks can be tested immediately.
 */

import { getUserOptions, setUserOptions } from '../model/options.js'
import { validateOptions } from '../model/validateOptions.js'

/**
 * Initialise the options editor view by loading and displaying user overrides.
 *
 * @returns {Promise<void>}
 */
export async function initOptions() {
  const userOptions = await getUserOptions()
  const userOptionsYaml = window.jsyaml.dump(userOptions)

  if (userOptionsYaml.trim() === '{}') {
    document.getElementById('config').value = ''
  } else {
    document.getElementById('config').value = userOptionsYaml
  }
  document.getElementById('opt-reset').addEventListener('click', resetOptions)
  document.getElementById('opt-save').addEventListener('click', saveOptions)
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
  const errorMessageEl = document.getElementById('error-message')

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
    if (errorMessageEl) {
      errorMessageEl.style.display = 'none'
      errorMessageEl.innerText = ''
    }
  } catch (e) {
    console.error(e)

    // Format validation errors from schema validation
    const validationMessage =
      e && Array.isArray(e.validationErrors) && e.validationErrors.length > 0
        ? e.validationErrors.join('\n')
        : e?.message

    if (errorMessageEl) {
      errorMessageEl.style.display = ''
      errorMessageEl.innerText = `Invalid: ${validationMessage}`
    }
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
}
