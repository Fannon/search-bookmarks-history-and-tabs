#!/usr/bin/env node
import { createWriteStream } from 'node:fs'
/**
 * @file Builds the Chrome-ready distribution directory and archive.
 *
 * Copies source assets into `dist/chrome`, swaps development scripts for
 * bundled equivalents, removes test fixtures, and packages the result as a zip
 * file. This mirrors the artifact uploaded to browser extension stores.
 */
import * as fs from 'node:fs/promises'
import { basename, relative, sep } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { ZipArchive } from 'archiver'

// Track CSS files that receive minified companions so we can prune originals
const CSS_BUNDLED_FILENAMES = new Set([
  'style.css',
  'options.css',
  'taxonomy.css',
  'editBookmark.css',
  'bookmarkManager.css',
])

/**
 * Build the Chrome distribution directory and accompanying archive.
 */
export async function createDist(clean = true) {
  // Remove and create directories
  if (clean) {
    await fs.rm('dist', { recursive: true, force: true })
  }
  await fs.mkdir('dist/chrome/images', { recursive: true })

  // Copy manifest
  await fs.copyFile('manifest.json', 'dist/chrome/manifest.json')

  // Copy images
  const images = ['logo-16.png', 'logo-32.png', 'logo-48.png', 'logo-128.png']
  await Promise.all(images.map((img) => fs.copyFile(`images/${img}`, `dist/chrome/images/${img}`)))

  // Rebuild the popup directory even during watch builds so removed files cannot linger.
  await fs.rm('dist/chrome/popup', { recursive: true, force: true })
  await fs.cp('popup', 'dist/chrome/popup', {
    recursive: true,
    filter: (source) => {
      const name = basename(source)
      if (name === 'mockData' || name === '__tests__' || name.endsWith('.test.js') || name.endsWith('.map')) {
        return false
      }
      // Entry bundles live directly in popup/js; their source modules are already bundled.
      if (relative('popup', source).startsWith(`js${sep}`)) {
        return name.endsWith('.bundle.min.js')
      }
      return !CSS_BUNDLED_FILENAMES.has(name)
    },
  })

  await Promise.all(
    ['index', 'tags', 'folders', 'groups', 'editBookmark', 'bookmarkManager'].map((page) =>
      modifyHtmlFile(`dist/chrome/popup/${page}.html`),
    ),
  )
  console.info('Created dist/chrome/')

  // Create zip archive
  const archive = new ZipArchive({ zlib: { level: 9 } })
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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createDist().catch((error) => {
    console.error('Failed to create distribution')
    console.error(error)
    process.exit(1)
  })
}

/**
 * Swap development script tags with production bundles in an HTML file.
 * @param {string} filePath HTML file to update.
 * @returns {Promise<void>}
 */
async function modifyHtmlFile(filePath) {
  const content = await fs.readFile(filePath, 'utf8')

  // Robustly replace init scripts with their bundled versions
  // This regex matches <script> tags pointing to ./js/init*.js and replaces them with the bundled .min.js version
  // It handles variations in attributes (like defer, type="module"), quotes, and optional ./ prefix
  let modified = content.replace(
    /<script\b[^>]*src=["']((\.\/)?js\/init[^"']+)\.js["'][^>]*>\s*<\/script>/gi,
    (_match, src) => {
      return `<script defer src="${src}.bundle.min.js"></script>`
    },
  )

  modified = replaceStylesheetReferences(modified)

  await fs.writeFile(filePath, modified, 'utf8')
}

/**
 * Swap unbundled stylesheet references with minified bundle versions.
 * @param {string} htmlContent HTML content to update.
 * @returns {string}
 */
function replaceStylesheetReferences(htmlContent) {
  // Robustly replace CSS references with their .min.css versions
  // This regex matches <link rel="stylesheet"> tags pointing to ./css/*.css and replaces them with the .min.css version
  // It handles variations in attributes, quotes, and optional ./ prefix.
  // It only replaces files that are tracked in CSS_BUNDLED_FILENAMES.
  return htmlContent.replace(
    /<link\b[^>]*href=["']((\.\/)?css\/([^"']+))\.css["'][^>]*\/?>/gi,
    (match, fullPath, _prefix, fileName) => {
      // Check if this CSS file is one that we minify/bundle
      if (CSS_BUNDLED_FILENAMES.has(`${fileName}.css`)) {
        return `<link rel="stylesheet" href="${fullPath}.min.css" />`
      }
      return match
    },
  )
}
