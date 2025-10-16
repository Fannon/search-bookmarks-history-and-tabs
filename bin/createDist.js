#!/usr/bin/env node
/* eslint-disable no-console */
import fs from 'fs-extra'
import { createWriteStream } from 'fs'
import { join } from 'path'
import archiver from 'archiver'

/**
 * Build the Chrome distribution directory and accompanying archive.
 */
export async function createDist(clean = true) {
  // Remove and create directories
  if (clean) {
    await fs.remove('dist')
  }
  await fs.ensureDir('dist/chrome')
  await fs.ensureDir('dist/chrome/images')

  // Copy manifest
  await fs.copy('manifest.json', 'dist/chrome/manifest.json')

  // Copy images
  const images = ['edit.svg', 'x.svg', 'logo-16.png', 'logo-32.png', 'logo-48.png', 'logo-128.png']
  await Promise.all(images.map((img) => fs.copy(`images/${img}`, `dist/chrome/images/${img}`)))

  // Copy popup directory
  await fs.copy('popup/', 'dist/chrome/popup/', { recursive: true })

  await modifyHtmlFile('dist/chrome/popup/options.html')
  await modifyHtmlFile('dist/chrome/popup/index.html')
  await modifyHtmlFile('dist/chrome/popup/tags.html')
  await modifyHtmlFile('dist/chrome/popup/folders.html')

  // Remove mock data and test artifacts
  await fs.remove('dist/chrome/popup/mockData')

  await removeBundledJs('dist/chrome/popup/js')

  const popupDir = 'dist/chrome/popup'
  await removeTestArtifacts(popupDir)
  console.info(`Created dist/chrome/`)

  // Create zip archive
  const archive = archiver('zip', { zlib: { level: 9 } })
  const output = createWriteStream('dist/chrome.zip')

  return new Promise((resolve, reject) => {
    output.on('close', () => {
      console.info(`Created dist/chrome.zip (${archive.pointer()} bytes)`)
      resolve()
    })

    archive.on('error', reject)

    archive.pipe(output)
    archive.directory('dist/chrome/', false)
    archive.finalize()
  })
}

createDist().catch((error) => {
  console.error('Failed to create distribution')
  console.error(error)
  // eslint-disable-next-line no-undef
  process.exit(1)
})

/**
 * Recursively delete non-bundled JavaScript files beneath a directory.
 * @param {string} dir Path to inspect for removable files.
 * @returns {Promise<void>}
 */
async function removeBundledJs(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        await removeBundledJs(fullPath)
        const remaining = await fs.readdir(fullPath)
        if (!remaining.length) {
          await fs.remove(fullPath)
        }
      } else if (entry.isFile() && entry.name.endsWith('.js') && !entry.name.endsWith('.bundle.min.js')) {
        await fs.remove(fullPath)
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error
    }
  }
}

/**
 * Remove test artifacts such as __tests__ directories and *.test.js files.
 * @param {string} dir Directory to traverse while pruning test files.
 * @returns {Promise<void>}
 */
async function removeTestArtifacts(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === '__tests__') {
          await fs.remove(fullPath)
        } else {
          await removeTestArtifacts(fullPath)
        }
      } else if (entry.isFile() && entry.name.endsWith('.test.js')) {
        await fs.remove(fullPath)
      }
    }
    // eslint-disable-next-line no-unused-vars
  } catch (ignore) {
    // Ignore errors if dir doesn't exist
  }
}

/**
 * Swap development script tags with production bundles in an HTML file.
 * @param {string} filePath HTML file to update.
 * @returns {Promise<void>}
 */
async function modifyHtmlFile(filePath) {
  const content = await fs.readFile(filePath, 'utf8')
  let modified = content
    .replace(
      '<script defer type="module" src="./js/initOptions.js"></script>',
      '<script defer src="./js/initOptions.bundle.min.js"></script>',
    )
    .replace(
      '<script defer type="module" src="./js/initSearch.js"></script>',
      '<script defer src="./js/initSearch.bundle.min.js"></script>',
    )
    .replace(
      '<script defer type="module" src="./js/initTags.js"></script>',
      '<script defer src="./js/initTags.bundle.min.js"></script>',
    )
    .replace(
      '<script defer type="module" src="./js/initFolders.js"></script>',
      '<script defer src="./js/initFolders.bundle.min.js"></script>',
    )

  await fs.writeFile(filePath, modified, 'utf8')
}
