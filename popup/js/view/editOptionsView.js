//////////////////////////////////////////
// EDIT OPTIONS VIEW                    //
//////////////////////////////////////////

import { getUserOptions, setUserOptions } from '../model/options.js'

export async function initOptions() {
  try {
    const userOptions = await getUserOptions()
    document.getElementById('user-config').value = jsyaml.dump(userOptions)
    document.getElementById('edit-options-reset').addEventListener('click', resetOptions)
    document.getElementById('edit-options-save').addEventListener('click', saveOptions)
  } catch (err) {
    console.error(err)
  }
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
  document.getElementById('user-config').value = '{\n  \n}'
}
