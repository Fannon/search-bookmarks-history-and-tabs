#!/usr/bin/env node
/* eslint-disable no-console */
import * as fs from 'fs-extra'
import { build } from 'esbuild'

async function updateLibs() {
  await fs.emptyDir('popup/lib')

  await Promise.all([
    fs.copy('node_modules/@leeoniya/ufuzzy/dist/uFuzzy.iife.min.js', 'popup/lib/uFuzzy.iife.min.js'),
    fs.copy('node_modules/mark.js/dist/mark.es6.min.js', 'popup/lib/mark.es6.min.js'),
    fs.copy('node_modules/js-yaml/dist/js-yaml.min.js', 'popup/lib/js-yaml.min.js'),
    fs.copy('node_modules/@yaireo/tagify/dist/tagify.js', 'popup/lib/tagify.min.js'),
    fs.copy('node_modules/@yaireo/tagify/dist/tagify.css', 'popup/lib/tagify.min.css'),
    build({
      entryPoints: ['node_modules/@exodus/schemasafe/src/index.js'],
      outfile: 'popup/lib/schemasafe.min.js',
      bundle: true,
      minify: true,
      format: 'iife',
      globalName: 'schemasafe',
      legalComments: 'none',
      platform: 'browser',
      target: ['es2019'],
    }),
  ])

  console.info('Updated libraries in popup/lib')
}

updateLibs().catch((error) => {
  console.error('Failed to update libraries')
  console.error(error)
  // eslint-disable-next-line no-undef
  process.exit(1)
})
