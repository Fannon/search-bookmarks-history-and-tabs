/**
 * @file Powers the options editor view.
 * Loads YAML overrides, validates edits, and routes back to search.
 */

import { getUserOptions, setUserOptions } from '../model/options.js'

/**
 * Initialize the options editor view by loading and displaying user overrides.
 * @returns {Promise<void>}
 */
export async function initOptions() {
  const userOptions = await getUserOptions()
  const userOptionsYaml = window.jsyaml.dump(userOptions)
  if (userOptionsYaml.trim() === '{}') {
    document.getElementById('user-config').value = ''
  } else {
    document.getElementById('user-config').value = userOptionsYaml
  }
  document.getElementById('edit-options-reset').addEventListener('click', resetOptions)
  document.getElementById('edit-options-save').addEventListener('click', saveOptions)
}

/**
 * Persist YAML updates back to storage and return users to the search view.
 * @returns {Promise<void>}
 */
async function saveOptions() {
  const userOptionsString = document.getElementById('user-config').value
  try {
    const userOptions = window.jsyaml.load(userOptionsString)
    document.getElementById('user-config').value = window.jsyaml.dump(userOptions)
    await setUserOptions(userOptions)
  } catch (e) {
    console.error(e)
    document.getElementById('error-message').style = ''
    document.getElementById('error-message').innerText = 'Invalid ' + e.message
    return
  }

  try {
    window.location.href = './index.html#search/'
  } catch (navigationError) {
    console.warn('Navigation to search view not supported in this environment.', navigationError)
  }
}

/** Clear user overrides so defaults apply on next load. */
async function resetOptions() {
  document.getElementById('user-config').value = ''
}
