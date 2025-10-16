#!/usr/bin/env node
/* eslint-disable no-console */

import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const thisFile = fileURLToPath(import.meta.url)
const thisDir = dirname(thisFile)
const repoRoot = resolve(thisDir, '..')

const jsBundles = [
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
  {
    name: 'initTags',
    entry: resolve(repoRoot, 'popup/js/initTags.js'),
    outfile: resolve(repoRoot, 'popup/js/initTags.bundle.min.js'),
    globalName: 'tagsPopup',
  },
  {
    name: 'initFolders',
    entry: resolve(repoRoot, 'popup/js/initFolders.js'),
    outfile: resolve(repoRoot, 'popup/js/initFolders.bundle.min.js'),
    globalName: 'foldersPopup',
  },
]

const sharedBuildOptions = {
  bundle: true,
  minify: true,
  keepNames: false,
  sourcemap: true,
  legalComments: 'none',
  target: ['chrome109', 'firefox115'],
  format: 'iife',
  external: ['../lib/mark.es6.min.js', './lib/mark.es6.min.js'],
  logLevel: 'info',
}

export async function bundleAll() {
  for (const { name, entry, outfile, globalName } of jsBundles) {
    await build({
      ...sharedBuildOptions,
      entryPoints: [entry],
      outfile,
      globalName,
    })
    console.log(`Bundled ${name} to ${outfile}`)
  }

  const cssBundles = [
    {
      name: 'style',
      entry: resolve(repoRoot, 'popup/css/style.css'),
      outfile: resolve(repoRoot, 'popup/css/style.bundle.min.css'),
    },
    {
      name: 'options',
      entry: resolve(repoRoot, 'popup/css/options.css'),
      outfile: resolve(repoRoot, 'popup/css/options.bundle.min.css'),
    },
    {
      name: 'taxonomy',
      entry: resolve(repoRoot, 'popup/css/taxonomy.css'),
      outfile: resolve(repoRoot, 'popup/css/taxonomy.bundle.min.css'),
    },
  ]

  for (const { name, entry, outfile } of cssBundles) {
    await build({
      entryPoints: [entry],
      outfile,
      minify: true,
      bundle: false,
      logLevel: 'info',
      loader: { '.css': 'css' },
    })
    console.log(`Bundled CSS ${name} to ${outfile}`)
  }
}

bundleAll().catch((error) => {
  console.error('Failed to bundle popup entrypoints')
  console.error(error)
  // eslint-disable-next-line no-undef
  process.exit(1)
})
