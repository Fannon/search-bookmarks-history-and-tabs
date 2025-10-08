#!/usr/bin/env node
/* eslint-disable no-console */
import * as fs from 'fs-extra'
import { createWriteStream } from 'fs'
import { join } from 'path'
import archiver from 'archiver'

async function createDist() {
  // Remove and create directories
  await fs.remove('dist')
  await fs.ensureDir('dist/chrome')
  await fs.ensureDir('dist/chrome/images')

  // Copy manifest
  await fs.copy('manifest.json', 'dist/chrome/manifest.json')

  // Copy images
  const images = ['edit.svg', 'x.svg', 'logo-16.png', 'logo-32.png', 'logo-48.png', 'logo-128.png']
  await Promise.all(images.map((img) => fs.copy(`images/${img}`, `dist/chrome/images/${img}`)))

  // Copy popup directory
  await fs.copy('popup/', 'dist/chrome/popup/', { recursive: true })

  // Remove mock data and test artifacts
  await fs.remove('dist/chrome/popup/mockData')

  // Remove test directories and files
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

  const popupDir = 'dist/chrome/popup'
  await removeTestArtifacts(popupDir)

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
    archive.directory('dist/chrome/', '.')
    archive.finalize()
  })
}

createDist().catch((error) => {
  console.error('Failed to create distribution')
  console.error(error)
  // eslint-disable-next-line no-undef
  process.exit(1)
})
