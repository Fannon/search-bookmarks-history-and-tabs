#!/usr/bin/env node
import * as fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const SOURCE_DIST_PATH = path.resolve('dist')
const DEV_DIST_PATH = '/mnt/c/Development/search-bookmarks-history-and-tabs/dist'

/**
 * Mirror the local build output into a second checkout when it exists.
 *
 * This is just convenience for the developer, so the step quietly no-ops when
 * the extra checkout is not available.
 */
export async function syncDevDist() {
  try {
    await fs.access(DEV_DIST_PATH)
  } catch (error) {
    if (error.code === 'ENOENT') return
    throw error
  }

  await fs.rm(DEV_DIST_PATH, { recursive: true, force: true })
  await fs.cp(SOURCE_DIST_PATH, DEV_DIST_PATH, { recursive: true })
  console.info(`Synced dist/ to ${DEV_DIST_PATH}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  syncDevDist().catch((error) => {
    console.error('Failed to sync dist to developer checkout')
    console.error(error)
    process.exit(1)
  })
}
