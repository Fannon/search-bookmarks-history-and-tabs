#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * @file Refreshes third-party libraries in popup/lib.
 * Copies browser-ready assets from node_modules so the popup can load them without a bundler.
 */
import * as fs from 'fs-extra'

/**
 * Copy third-party popup dependencies from node_modules into the workspace.
 * @returns {Promise<void>}
 */
async function updateLibs() {
  // Clear stale assets so the directory mirrors current dependency versions
  await fs.emptyDir('popup/lib')

  await Promise.all([
    fs.copy('node_modules/@leeoniya/ufuzzy/dist/uFuzzy.iife.min.js', 'popup/lib/uFuzzy.iife.min.js'),
    fs.copy('node_modules/mark.js/dist/mark.es6.min.js', 'popup/lib/mark.es6.min.js'),
    fs.copy('node_modules/js-yaml/dist/js-yaml.min.js', 'popup/lib/js-yaml.min.js'),
    fs.copy('node_modules/@yaireo/tagify/dist/tagify.js', 'popup/lib/tagify.min.js'),
    fs.copy('node_modules/@yaireo/tagify/dist/tagify.css', 'popup/lib/tagify.min.css'),
  ])

  console.info('Updated libraries in popup/lib')
}

updateLibs().catch((error) => {
  console.error('Failed to update libraries')
  console.error(error)
  // eslint-disable-next-line no-undef
  process.exit(1)
})
