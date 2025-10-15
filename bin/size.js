#!/usr/bin/env node
/* eslint-disable no-console */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const DIST_ROOT = path.resolve('dist/chrome')

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

function percentage(value, total) {
  if (total === 0) {
    return '0%'
  }
  return `${((value / total) * 100).toFixed(1)}%`
}

async function summarise(files) {
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

    if (file.path.endsWith('.min.js') && file.path.startsWith('popup/js/')) {
      minified.push(file)
    }
  }

  // Add chrome.zip to minified files (created as part of build process)
  const chromeZipPath = path.resolve('dist/chrome.zip')
  try {
    const zipStats = await fs.stat(chromeZipPath)
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

function printTable(headers, rows, indent = '') {
  if (rows.length === 0) {
    return
  }

  const columnWidths = headers.map((header, index) => {
    return Math.max(header.length, ...rows.map((row) => row[index].length))
  })

  const formatRow = (row) => indent + row.map((value, index) => value.padEnd(columnWidths[index])).join('  ')
  const divider = indent + columnWidths.map((width) => ''.padEnd(width, '-')).join('  ')

  console.log(formatRow(headers))
  console.log(divider)
  for (const row of rows) {
    console.log(formatRow(row))
  }
}

function printSummary({ totalSize, sortedTopLevel, sortedSecondLevel, sortedMinified }, fileCount) {
  const displayRoot = path.relative(process.cwd(), DIST_ROOT).split(path.sep).join('/') || '.'
  console.log(`Build size summary for ${displayRoot}`)
  console.log(`Total size: ${formatBytes(totalSize)} across ${fileCount} files`)
  console.log('')

  if (fileCount === 0) {
    console.log('No files found.')
    return
  }

  console.log('Top-level contributions:')
  const topRows = sortedTopLevel.map(([name, size]) => [name, formatBytes(size), percentage(size, totalSize)])
  printTable(['Section', 'Size', 'Share'], topRows, '  ')

  for (const [name] of sortedTopLevel) {
    if (name === 'images') {
      continue
    }
    const segments = sortedSecondLevel.get(name)
    if (!segments || segments.length === 0) {
      continue
    }
    console.log('')
    console.log(`${name} breakdown:`)
    const rows = segments.map(([segmentName, size]) => [segmentName, formatBytes(size), percentage(size, totalSize)])
    printTable(['Folder', 'Size', 'Share'], rows, '  ')
  }

  console.log('')
  console.log('Optimized files (minified JS and archives):')
  const minRows = sortedMinified.map((file) => [file.path, formatBytes(file.size), percentage(file.size, totalSize)])
  printTable(['File', 'Size', 'Share'], minRows, '  ')
}

async function main() {
  if (!(await ensureDistExists(DIST_ROOT))) {
    return
  }

  const files = await walkFiles(DIST_ROOT, DIST_ROOT)
  const summary = await summarise(files)
  printSummary(summary, files.length)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
