#!/usr/bin/env node
/**
 * @file Synchronizes manifest version with package.json.
 *
 * Keeps the browser extension manifest in lockstep with the npm package version
 * so publishing workflows only require updating package.json.
 */
import fs from 'node:fs'

const packageJson = JSON.parse(fs.readFileSync('package.json').toString())
const manifestSource = fs.readFileSync('manifest.json', 'utf8')

console.log(`Updating Manifests with version v${packageJson.version}`)

fs.writeFileSync(
  'manifest.json',
  manifestSource.replace(/("version"\s*:\s*)"[^"]*"/, (_match, prefix) => prefix + JSON.stringify(packageJson.version)),
)
