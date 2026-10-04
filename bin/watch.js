#!/usr/bin/env node
import { watch } from 'node:fs'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
/**
 * @file Watches popup sources and triggers incremental rebuilds.
 *
 * Listens for changes under `popup/`, reruns the esbuild bundler, and refreshes
 * the Chrome distribution directory. Designed for `npm run watch` to keep the
 * side-loaded extension in sync without manual rebuilds.
 */
import { bundleAll } from './bundle.js'
import { createDist } from './createDist.js'
import { syncDevDist } from './syncDevDist.js'

/**
 * Determine whether a changed file should be ignored by the watcher.
 *
 * @param {string} filePath - Path relative to the watched popup directory.
 * @returns {boolean} True when the path should be skipped.
 */
const isIgnoredPath = (filePath) => {
  if (!filePath) return false

  const normalized = filePath.replace(/\\/g, '/')

  if (normalized === 'lib' || normalized.startsWith('lib/')) {
    return true
  }

  const fileName = normalized.substring(normalized.lastIndexOf('/') + 1)
  return /\.min\.(js|css)(\.map)?$/i.test(fileName)
}

let pendingTimer = null
let isBuilding = false
let hasQueuedBuild = false

/**
 * Run a single bundle + dist build, sync the developer dist mirror, and report timing.
 *
 * @returns {Promise<void>}
 */
async function buildOnce() {
  console.info('Starting build...')
  const startedAt = performance.now()
  await bundleAll()
  await createDist(false)
  await syncDevDist()
  const finishedAt = performance.now()
  const durationMs = Math.round(finishedAt - startedAt)
  console.info(`Build complete in ${durationMs}ms`)
}

/**
 * Serialise build executions, queueing the next run if one is in progress.
 *
 * @returns {Promise<void>}
 */
async function runBuild() {
  if (isBuilding) {
    // Defer the rebuild until the current bundle completes to avoid overlaps
    hasQueuedBuild = true
    return
  }

  isBuilding = true
  try {
    await buildOnce()
  } catch (error) {
    console.error('Build failed', error)
  } finally {
    isBuilding = false

    if (hasQueuedBuild) {
      hasQueuedBuild = false
      await runBuild()
    }
  }
}

/**
 * Debounce rapid filesystem events before kicking off another build.
 */
const scheduleBuild = () => {
  if (pendingTimer) {
    clearTimeout(pendingTimer)
  }

  // Coalesce rapid file change events into a single rebuild invocation
  pendingTimer = setTimeout(() => {
    pendingTimer = null
    // Refresh inode watches so atomic saves remain observable on Linux.
    watcher.close()
    watcher = watchPopup()
    runBuild()
  }, 250)
}

function watchPopup() {
  return watch('popup', { recursive: true }, (eventName, filePath) => {
    if (isIgnoredPath(filePath)) {
      return
    }

    console.info(`Detected ${eventName} on ${filePath}`)
    scheduleBuild()
  })
}

let watcher = watchPopup()
console.info('Watching popup/ for changes')
runBuild()

/**
 * Cancel pending timers and close the watcher before exit.
 */
const cleanup = () => {
  if (pendingTimer) {
    clearTimeout(pendingTimer)
  }

  watcher.close()
}

process.on('SIGINT', () => {
  cleanup()
  process.exit(0)
})

process.on('SIGTERM', () => {
  cleanup()
  process.exit(0)
})

process.on('exit', () => {
  cleanup()
})
