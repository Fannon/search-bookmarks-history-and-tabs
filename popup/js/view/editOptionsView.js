//////////////////////////////////////////
// EDIT OPTIONS VIEW                    //
//////////////////////////////////////////

import { getUserOptions, setUserOptions } from '../model/options.js'

export async function initOptions() {
  const userOptions = await getUserOptions()
  const userOptionsYaml = jsyaml.dump(userOptions)
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
    const userOptions = jsyaml.load(userOptionsString)
    document.getElementById('user-config').value = jsyaml.dump(userOptions)
    await setUserOptions(userOptions)
    window.location.href = './index.html#search/'
  } catch (e) {
    console.error(e)
    document.getElementById('error-message').style = ''
    document.getElementById('error-message').innerText = 'Invalid ' + e.message
  }
}

async function resetOptions() {
  document.getElementById('user-config').value = ''
}
