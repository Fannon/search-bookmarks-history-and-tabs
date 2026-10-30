import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import * as fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)

test('manifest version updates preserve existing formatting and remain stable on rebuild', async () => {
  const fixture = await fs.mkdtemp(path.join(tmpdir(), 'bookmark-manifest-'))
  try {
    const manifest = '{\n  "manifest_version": 3,\n  "version": "1.0.0",\n  "permissions": ["tabs", "bookmarks"]\n}\n'
    await fs.writeFile(path.join(fixture, 'manifest.json'), manifest)
    await fs.writeFile(path.join(fixture, 'package.json'), '{"version":"2.5.1"}')
    for (let i = 0; i < 2; i++) {
      await run(process.execPath, [fileURLToPath(new URL('../updateManifests.js', import.meta.url))], { cwd: fixture })
      assert.strictEqual(
        await fs.readFile(path.join(fixture, 'manifest.json'), 'utf8'),
        manifest.replace('1.0.0', '2.5.1'),
      )
    }
  } finally {
    await fs.rm(fixture, { recursive: true, force: true })
  }
})
