#!/usr/bin/env node
/* eslint-disable no-console */

import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const thisFile = fileURLToPath(import.meta.url)
const thisDir = dirname(thisFile)
const repoRoot = resolve(thisDir, '..')

const bundles = [
  {
    name: 'initSearch',
    entry: resolve(repoRoot, 'popup/js/initSearch.js'),
    outfile: resolve(repoRoot, 'popup/js/initSearch.bundle.min.js'),
    globalName: 'searchPopup',
  },
  {
    name: 'initOptions',
    entry: resolve(repoRoot, 'popup/js/initOptions.js'),
    outfile: resolve(repoRoot, 'popup/js/initOptions.bundle.min.js'),
    globalName: 'optionsPopup',
  },
]

const sharedBuildOptions = {
  bundle: true,
  minify: true,
  keepNames: true,
  sourcemap: true,
  legalComments: 'none',
  target: ['chrome109', 'firefox115'],
  format: 'iife',
  external: ['../lib/mark.es6.min.js', './lib/mark.es6.min.js'],
  logLevel: 'info',
}

async function bundleAll() {
  for (const { name, entry, outfile, globalName } of bundles) {
    await build({
      ...sharedBuildOptions,
      entryPoints: [entry],
      outfile,
      globalName,
    })
    console.log(`Bundled ${name} to ${outfile}`)
  }
}

bundleAll().catch((error) => {
  console.error('Failed to bundle popup entrypoints')
  console.error(error)
  // eslint-disable-next-line no-undef
  process.exit(1)
})
