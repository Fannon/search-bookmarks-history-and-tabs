/**
 * @file Bootstraps the popup options editor (`popup/options.html`).
 *
 * Responsibilities:
 * - Create the shared extension context so option changes reuse the same global state as the popup.
 * - Delegate UI construction and persistence logic to `editOptionsView` for clearer separation of concerns.
 * - Surface initialization errors via the common `printError` helper to align UX with other entry points.
 */

import { createExtensionContext } from './helper/extensionContext.js'
import { initOptions } from './view/editOptionsView.js'
import { printError } from './view/errorView.js'

export const ext = createExtensionContext()
window.ext = ext

// Trigger initialization
initOptions().catch((err) => {
  printError(err, 'Could not initialize options view.')
})
