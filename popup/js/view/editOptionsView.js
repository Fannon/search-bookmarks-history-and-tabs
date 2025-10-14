//////////////////////////////////////////
// EDIT OPTIONS VIEW                    //
//////////////////////////////////////////

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
  const errorMessageEl = document.getElementById('error-message')
  try {
    const userOptions = window.jsyaml.load(userOptionsString)
    document.getElementById('user-config').value = window.jsyaml.dump(userOptions)
    await setUserOptions(userOptions)
    errorMessageEl.style = 'display:none'
    errorMessageEl.innerText = ''
  } catch (e) {
    console.error(e)
    const validationMessage =
      e && Array.isArray(e.validationErrors) && e.validationErrors.length > 0
        ? e.validationErrors.join('\n')
        : e && e.message
    errorMessageEl.style = ''
    errorMessageEl.innerText = 'Invalid ' + validationMessage
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
