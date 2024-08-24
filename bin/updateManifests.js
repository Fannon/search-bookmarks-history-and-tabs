import fs from 'fs'

const packageJson = JSON.parse(fs.readFileSync('package.json').toString())
const manifestJson = JSON.parse(fs.readFileSync('manifest.json').toString())
const manifestFirefoxJson = JSON.parse(fs.readFileSync('manifest.firefox.json').toString())

console.log('Updating Manifests with version v' + packageJson.version)

manifestJson.version = packageJson.version
manifestFirefoxJson.version = packageJson.version

fs.writeFileSync('manifest.json', JSON.stringify(manifestJson, null, 2))
fs.writeFileSync('manifest.firefox.json', JSON.stringify(manifestFirefoxJson, null, 2))
