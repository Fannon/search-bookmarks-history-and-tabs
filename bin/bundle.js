#!/usr/bin/env node

/**
 * @file Bundles popup entry points and styles with esbuild.
 *
 * Produces minified IIFE bundles for each popup entry module and companion CSS
 * files. This script mirrors the production build that ships to extension
 * stores and is invoked by `npm run build:bundle` and the watch pipeline.
 */

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

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
  {
    name: 'initEditBookmark',
    entry: resolve(repoRoot, 'popup/js/initEditBookmark.js'),
    outfile: resolve(repoRoot, 'popup/js/initEditBookmark.bundle.min.js'),
    globalName: 'editBookmarkPopup',
  },
]

// Shared esbuild options keep bundle output consistent between entry points
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

/**
 * Build minified JavaScript and CSS bundles for all popup entry points.
 *
 * @returns {Promise<void>}
 */
export async function bundleAll() {
  for (const { name, entry, outfile, globalName } of jsBundles) {
    // Execute builds sequentially so esbuild reuses its worker pool efficiently
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
      outfile: resolve(repoRoot, 'popup/css/style.min.css'),
    },
    {
      name: 'options',
      entry: resolve(repoRoot, 'popup/css/options.css'),
      outfile: resolve(repoRoot, 'popup/css/options.min.css'),
    },
    {
      name: 'taxonomy',
      entry: resolve(repoRoot, 'popup/css/taxonomy.css'),
      outfile: resolve(repoRoot, 'popup/css/taxonomy.min.css'),
    },
    {
      name: 'editBookmark',
      entry: resolve(repoRoot, 'popup/css/editBookmark.css'),
      outfile: resolve(repoRoot, 'popup/css/editBookmark.min.css'),
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
  process.exit(1)
})
