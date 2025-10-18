#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * @file Watches popup sources and triggers incremental rebuilds.
 *
 * Listens for changes under `popup/`, reruns the esbuild bundler, and refreshes
 * the Chrome distribution directory. Designed for `npm run watch` to keep the
 * side-loaded extension in sync without manual rebuilds.
 */
import chokidar from 'chokidar'
import process from 'node:process'
import { performance } from 'node:perf_hooks'
import { bundleAll } from './bundle.js'
import { createDist } from './createDist.js'

/**
 * Determine whether a changed file should be ignored by the watcher.
 *
 * @param {string} filePath - Path reported by chokidar.
 * @returns {boolean} True when the path should be skipped.
 */
const isIgnoredPath = (filePath) => {
  if (!filePath) return false

  const normalized = filePath.replace(/\\/g, '/')

  if (normalized.startsWith('popup/lib') || normalized.includes('/popup/lib/') || normalized.endsWith('/popup/lib')) {
    return true
  }

  const fileName = normalized.substring(normalized.lastIndexOf('/') + 1)
  return /\.min\.(js|css)(\.map)?$/i.test(fileName)
}

const watcher = chokidar.watch('popup', {
  ignoreInitial: true,
  persistent: true,
  ignored: isIgnoredPath,
  awaitWriteFinish: {
    stabilityThreshold: 200,
    pollInterval: 100,
  },
})

let pendingTimer = null
let isBuilding = false
let hasQueuedBuild = false

/**
 * Run a single bundle + dist build and report timing.
 *
 * @returns {Promise<void>}
 */
async function buildOnce() {
  console.info('Starting build...')
  const startedAt = performance.now()
  await bundleAll()
  await createDist(false)
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
    return
  }

  // Coalesce rapid file change events into a single rebuild invocation
  pendingTimer = setTimeout(() => {
    pendingTimer = null
    runBuild()
  }, 250)
}

watcher.on('ready', () => {
  console.info('Watching popup/ for changes')
  runBuild()
})

watcher.on('all', (eventName, filePath) => {
  if (isIgnoredPath(filePath)) {
    return
  }

  console.info(`Detected ${eventName} on ${filePath}`)
  scheduleBuild()
})

/**
 * Cancel pending timers and close the watcher before exit.
 */
const cleanup = () => {
  if (pendingTimer) {
    clearTimeout(pendingTimer)
  }

  watcher.close().catch(() => {})
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
