#!/usr/bin/env node
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import fs from 'fs-extra'

const SOURCE_DIST_PATH = path.resolve('dist')
const DEV_DIST_PATH = '/mnt/c/Development/search-bookmarks-history-and-tabs/dist'

/**
 * Mirror the local build output into a second checkout when it exists.
 *
 * This is just convenience for the developer, so the step quietly no-ops when
 * the extra checkout is not available.
 */
export async function syncDevDist() {
  const devDistExists = await fs.pathExists(DEV_DIST_PATH)
  if (!devDistExists) {
    return
  }

  await fs.remove(DEV_DIST_PATH)
  await fs.copy(SOURCE_DIST_PATH, DEV_DIST_PATH)
  console.info(`Synced dist/ to ${DEV_DIST_PATH}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  syncDevDist().catch((error) => {
    console.error('Failed to sync dist to developer checkout')
    console.error(error)
    process.exit(1)
  })
}
