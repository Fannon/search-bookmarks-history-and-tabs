/**
 * @file Bootstraps the popup options editor (`popup/options.html`).
 * Sets up shared context and delegates UI logic to `editOptionsView`.
 */

import { printError } from './helper/utils.js'
import { initOptions } from './view/editOptionsView.js'
import { createExtensionContext } from './helper/extensionContext.js'

export const ext = (window.ext = createExtensionContext())

// Trigger initialization
initOptions().catch((err) => {
  printError(err, 'Could not initialize options view.')
})
