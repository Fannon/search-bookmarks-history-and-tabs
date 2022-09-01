import { printError } from './helper/utils.js'
import { extensionNamespace as ext } from './model/namespace.js'
import { initOptions } from './view/editOptionsView.js'

window.ext = ext

// Trigger initialization
initOptions().catch((err) => {
  printError(err, 'Could not initialize options view.')
})
