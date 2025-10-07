#!/usr/bin/env node
/* eslint-disable no-console */

import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const thisFile = fileURLToPath(import.meta.url)
const thisDir = dirname(thisFile)
const repoRoot = resolve(thisDir, '..')
const entryFile = resolve(repoRoot, 'popup/js/initSearch.js')
const outputFile = resolve(repoRoot, 'popup/js/initSearch.bundle.min.js')

async function bundleInitSearch() {
  const result = await build({
    entryPoints: [entryFile],
    bundle: true,
    minify: true,
    keepNames: true,
    sourcemap: false,
    legalComments: 'none',
    target: ['chrome109', 'firefox115'],
    format: 'iife',
    globalName: 'searchPopup',
    outfile: outputFile,
    logLevel: 'info',
  })

  console.log(`Bundled initSearch to ${outputFile}`)
  return result
}

bundleInitSearch().catch((error) => {
  console.error('Failed to bundle initSearch.js')
  console.error(error)
  // eslint-disable-next-line no-undef
  process.exit(1)
})
