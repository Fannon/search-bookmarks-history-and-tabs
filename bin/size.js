#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * @file Reports bundle sizes for the packaged Chrome distribution.
 *
 * Traverses `dist/chrome`, summarizes file sizes by directory, and surfaces the
 * largest minified assets. The report helps monitor regressions after running
 * `npm run build` or CI artifact generation.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const DIST_ROOT = path.resolve('dist/chrome')

/**
 * Ensure the dist directory exists before computing sizes.
 *
 * @param {string} dir - Directory to verify.
 * @returns {Promise<boolean>} False when directory is missing.
 */
async function ensureDistExists(dir) {
  try {
    const stats = await fs.stat(dir)
    if (!stats.isDirectory()) {
      throw new Error(`${dir} is not a directory`)
    }
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      console.error(`Missing build output at ${dir}. Run "npm run build" first.`)
      process.exitCode = 1
      return false
    }
    throw error
  }
  return true
}

/**
 * Recursively collect all files beneath a directory.
 *
 * @param {string} dir - Directory to walk.
 * @param {string} base - Base path for relative conversion.
 * @returns {Promise<Array<{path: string, size: number}>>}
 */
async function walkFiles(dir, base) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    const relPath = path.relative(base, fullPath)

    if (entry.isDirectory()) {
      files.push(...(await walkFiles(fullPath, base)))
    } else if (entry.isFile()) {
      const { size } = await fs.stat(fullPath)
      files.push({ path: relPath.split(path.sep).join('/'), size })
    }
  }

  return files
}

/**
 * Convert byte counts into human readable strings.
 *
 * @param {number} bytes - Raw byte size.
 * @returns {string} Human readable size.
 */
function formatBytes(bytes) {
  if (bytes === 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exponent
  const digits = value < 10 && exponent > 0 ? 2 : 1
  return `${value.toFixed(digits)} ${units[exponent]}`
}

/**
 * Calculate a share percentage string for a value.
 *
 * @param {number} value - Value to compare.
 * @param {number} total - Total used as denominator.
 * @returns {string} Percentage string.
 */
function percentage(value, total) {
  if (total === 0) {
    return '0%'
  }
  return `${((value / total) * 100).toFixed(1)}%`
}

/**
 * Summarize file sizes by directory depth and minified asset type.
 *
 * @param {Array<{path: string, size: number}>} files - Files to analyze.
 * @returns {Promise<Object>} Aggregated size metadata.
 */
async function summarize(files) {
  const totalSize = files.reduce((sum, file) => sum + file.size, 0)

  const topLevel = new Map()
  const secondLevel = new Map()
  const minified = []

  for (const file of files) {
    const segments = file.path.split('/')
    const primaryKey = segments[0] ?? '(root)'
    const secondaryKey = segments[1]

    topLevel.set(primaryKey, (topLevel.get(primaryKey) ?? 0) + file.size)

    if (secondaryKey) {
      const bucket = secondLevel.get(primaryKey) ?? new Map()
      secondLevel.set(primaryKey, bucket)
      bucket.set(secondaryKey, (bucket.get(secondaryKey) ?? 0) + file.size)
    }

    const isPopupMinifiedJs = file.path.endsWith('.min.js') && file.path.startsWith('popup/js/')
    const isStyleMinCss = path.basename(file.path) === 'style.min.css'

    if (isPopupMinifiedJs || isStyleMinCss) {
      minified.push(file)
    }
  }

  // Add chrome.zip to minified files (created as part of build process)
  const chromeZipPath = path.resolve('dist/chrome.zip')
  try {
    const zipStats = await fs.stat(chromeZipPath)
    // Include the shipping artifact so the table captures archive growth
    minified.push({ path: 'dist/chrome.zip', size: zipStats.size })
  } catch {
    // Zip file not found, likely build hasn't been run with zip creation
  }

  const sortedTopLevel = [...topLevel.entries()].sort((a, b) => b[1] - a[1])
  const sortedSecondLevel = new Map()

  for (const [topName, bucket] of secondLevel.entries()) {
    sortedSecondLevel.set(
      topName,
      [...bucket.entries()].sort((a, b) => b[1] - a[1]),
    )
  }

  const sortedMinified = minified.sort((a, b) => b.size - a.size)

  return { totalSize, sortedTopLevel, sortedSecondLevel, sortedMinified }
}

/**
 * Print a fixed-width table to stdout.
 *
 * @param {Array<string>} headers - Column headers.
 * @param {Array<Array<string>>} rows - Table rows.
 * @param {string} [indent=''] - Optional prefix for each line.
 * @param {Array<number>} [columnWidths] - Precomputed column widths.
 */
function printTable(headers, rows, indent = '', columnWidths) {
  if (rows.length === 0) {
    return
  }

  const widths =
    columnWidths ??
    headers.map((header, index) => {
      return Math.max(header.length, ...rows.map((row) => row[index].length))
    })

  const formatRow = (row) => indent + row.map((value, index) => value.padEnd(widths[index])).join('  ')
  const divider = indent + widths.map((width) => ''.padEnd(width, '-')).join('  ')

  console.log(formatRow(headers))
  console.log(divider)
  for (const row of rows) {
    console.log(formatRow(row))
  }
}

/**
 * Print a tree-style summary of directory sizes.
 *
 * @param {Array<Object>} entries - Hierarchical entries with children.
 * @param {number} totalSize - Total size for percentage calculations.
 * @param {string} [indent='  '] - Initial indentation.
 */
function printTree(entries, totalSize, indent = '  ') {
  if (!entries || entries.length === 0) {
    return
  }

  const traverse = (nodes, prefix) => {
    nodes.forEach((node, index) => {
      const isLast = index === nodes.length - 1
      const branch = isLast ? '└─ ' : '├─ '
      console.log(`${prefix}${branch}${node.name} (${formatBytes(node.size)}, ${percentage(node.size, totalSize)})`)
      if (node.children && node.children.length > 0) {
        const nextPrefix = `${prefix}${isLast ? '   ' : '│  '}`
        traverse(node.children, nextPrefix)
      }
    })
  }

  traverse(entries, indent)
}

/**
 * Render the overall bundle size summary, including top-level tree and tables.
 *
 * @param {Object} summary - Aggregated size details from `summarize`.
 * @param {number} fileCount - Number of files processed.
 */
function printSummary({ totalSize, sortedTopLevel, sortedSecondLevel, sortedMinified }, fileCount) {
  if (fileCount === 0) {
    console.log('No files found.')
    return
  }

  console.log(`<root> (${formatBytes(totalSize)}, ${fileCount} files)`)
  const topEntries = sortedTopLevel.map(([name, size]) => {
    const segments = sortedSecondLevel.get(name)
    const shouldAttachChildren = segments && segments.length > 0 && name !== 'images'
    const children = shouldAttachChildren
      ? segments.map(([segmentName, segmentSize]) => ({ name: segmentName, size: segmentSize }))
      : undefined
    return { name, size, children }
  })
  printTree(topEntries, totalSize)

  console.log('')
  const categorized = new Map([
    ['ZIP File', []],
    ['Minified JS', []],
    ['Minified CSS', []],
    ['Other', []],
  ])

  for (const file of sortedMinified) {
    if (file.path.endsWith('.zip')) {
      categorized.get('ZIP File').push(file)
    } else if (file.path.endsWith('.js')) {
      categorized.get('Minified JS').push(file)
    } else if (file.path.endsWith('.css')) {
      categorized.get('Minified CSS').push(file)
    } else {
      categorized.get('Other').push(file)
    }
  }

  const stripPrefix = (filePath) => filePath.replace(/^dist\//, '').replace(/^popup\//, '')
  const allRows = sortedMinified.map((file) => [
    stripPrefix(file.path),
    formatBytes(file.size),
    percentage(file.size, totalSize),
  ])
  let tableHeaders = ['File', 'Size', 'Share']
  const columnWidths = tableHeaders.map((header, index) => {
    return Math.max(header.length, ...allRows.map((row) => row[index].length))
  })

  for (const [label, files] of categorized) {
    tableHeaders = [label, 'Size', 'Share']
    if (files.length === 0) {
      continue
    }
    const rows = files
      .slice()
      .sort((a, b) => b.size - a.size)
      .map((file) => [stripPrefix(file.path), formatBytes(file.size), percentage(file.size, totalSize)])
    printTable(tableHeaders, rows, '', columnWidths)
    console.log('')
  }
}

/**
 * Entry point for the size reporting script.
 */
async function main() {
  if (!(await ensureDistExists(DIST_ROOT))) {
    return
  }

  const files = await walkFiles(DIST_ROOT, DIST_ROOT)
  const summary = await summarize(files)
  printSummary(summary, files.length)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
