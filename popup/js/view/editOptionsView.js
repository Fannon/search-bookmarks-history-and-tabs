//////////////////////////////////////////
// EDIT OPTIONS VIEW                    //
//////////////////////////////////////////

import { getEffectiveOptions, setUserOptions } from '../model/options.js'

export async function initOptions() {
  const effectiveOptions = await getEffectiveOptions()
  const yaml = window.jsyaml.dump(effectiveOptions)
  document.getElementById('user-config').value = yaml || 'searchStrategy: precise\n'
  document.getElementById('edit-options-reset').addEventListener('click', resetOptions)
  document.getElementById('edit-options-save').addEventListener('click', saveOptions)
}

async function saveOptions() {
  const userOptionsString = document.getElementById('user-config').value
  try {
    const userOptions = window.jsyaml.load(userOptionsString)
    document.getElementById('user-config').value = window.jsyaml.dump(userOptions)
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
