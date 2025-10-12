#!/usr/bin/env node
/* eslint-disable no-console */
import chokidar from 'chokidar'
import { spawn } from 'node:child_process'
import process from 'node:process'

const isIgnoredPath = (filePath) => {
  if (!filePath) return false

  const normalized = filePath.replace(/\\/g, '/')

  if (normalized.startsWith('popup/lib') || normalized.includes('/popup/lib/') || normalized.endsWith('/popup/lib')) {
    return true
  }

  const fileName = normalized.substring(normalized.lastIndexOf('/') + 1)
  return /\.bundle\.min\.js(\.map)?$/.test(fileName)
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
let buildProcess = null
let rerunRequested = false

const runBuild = () => {
  if (buildProcess) {
    rerunRequested = true
    return
  }

  console.info('Starting build...')
  buildProcess = spawn('npm', ['run', 'build'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  buildProcess.on('exit', (code) => {
    const succeeded = code === 0
    buildProcess = null

    if (succeeded) {
      console.info('Build finished')
    } else {
      console.error(`Build exited with code ${code}`)
    }

    if (rerunRequested) {
      rerunRequested = false
      runBuild()
    }
  })
}

const scheduleBuild = () => {
  if (pendingTimer) {
    return
  }

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

const cleanup = () => {
  if (pendingTimer) {
    clearTimeout(pendingTimer)
  }

  watcher.close().catch(() => {})

  if (buildProcess) {
    buildProcess.kill('SIGTERM')
  }
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
