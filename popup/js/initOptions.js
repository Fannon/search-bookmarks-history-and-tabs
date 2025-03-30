import { printError } from './helper/utils.js'
import { initOptions } from './view/editOptionsView.js'
import { browserApi } from './helper/browserApi.js'

export const ext = {
  opts: {},
  dom: {},
  browserApi: browserApi,
  initialized: false,
}

window.ext = ext

// Trigger initialization
initOptions().catch((err) => {
  printError(err, 'Could not initialize options view.')
})
