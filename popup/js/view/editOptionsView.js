//////////////////////////////////////////
// SETTINGS/OPTIONS PAGE VIEW           //
//////////////////////////////////////////

/**
 * Settings page UI for user configuration
 *
 * Responsibilities:
 * - Load and display user configuration as YAML
 * - Provide save/reset functionality for options
 * - Parse and validate YAML/JSON input
 * - Handle errors in configuration parsing
 * - Redirect to search page after successful save
 *
 * Configuration Format:
 * - Users can override default options using YAML or JSON
 * - Examples: searchStrategy, searchFuzzyness, enableTabs, historyMaxItems, etc.
 * - Configuration stored in browser storage and merged with defaults
 *
 * Error Handling:
 * - Displays error messages for invalid YAML/JSON syntax
 * - Prevents saving malformed configuration
 */

import { getUserOptions, setUserOptions } from '../model/options.js'

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

async function resetOptions() {
  document.getElementById('user-config').value = ''
}
