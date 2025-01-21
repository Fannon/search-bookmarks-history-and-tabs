/* eslint-disable no-console */
import fs from 'fs'

const packageJson = JSON.parse(fs.readFileSync('package.json').toString())
const manifestJson = JSON.parse(fs.readFileSync('manifest.json').toString())

console.log('Updating Manifests with version v' + packageJson.version)

manifestJson.version = packageJson.version

fs.writeFileSync('manifest.json', JSON.stringify(manifestJson, null, 2))
