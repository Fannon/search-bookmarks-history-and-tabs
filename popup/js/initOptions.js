//////////////////////////////////////////
// SETTINGS PAGE ENTRY POINT            //
//////////////////////////////////////////

/**
 * Entry point for the settings/options page (popup/options.html)
 *
 * Responsibilities:
 * - Initialize the shared extension context (ext object)
 * - Set up the options/settings page UI
 * - Load and bind user configuration from browser storage
 * - Handle save/reset actions for YAML/JSON option overrides
 *
 * This page allows users to customize extension behavior by editing
 * YAML/JSON configuration that gets merged with default options.
 */

import { printError } from './helper/utils.js'
import { initOptions } from './view/editOptionsView.js'
import { createExtensionContext } from './helper/extensionContext.js'

export const ext = (window.ext = createExtensionContext())

// Trigger initialization
initOptions().catch((err) => {
  printError(err, 'Could not initialize options view.')
})
