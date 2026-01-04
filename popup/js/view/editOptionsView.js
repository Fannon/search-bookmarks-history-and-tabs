/**
 * @file Powers the options editor view.
 *
 * Responsibilities:
 * - Load persisted configuration, present it as YAML, and keep the textarea in sync with stored overrides.
 * - Validate user edits, surface parse errors inline, and persist accepted changes via the options model.
 * - Provide reset/save controls and navigate back to the search view so tweaks can be tested immediately.
 */

import { getUserOptions, setUserOptions } from '../model/options.js'

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
 * @returns {Promise<void>}
 */
async function saveOptions() {
  const userOptionsString = document.getElementById('config').value
  const errorMessageEl = document.getElementById('error-message')

  try {
    const userOptions = window.jsyaml.load(userOptionsString)
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
