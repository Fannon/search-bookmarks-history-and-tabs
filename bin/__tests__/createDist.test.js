/** @jest-environment node */

import { execFile } from 'node:child_process'
import * as fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { afterEach, expect, test } from '@jest/globals'

const run = promisify(execFile)
const script = new URL('../createDist.js', import.meta.url)
let fixture

afterEach(async () => {
  if (fixture) await fs.rm(fixture, { recursive: true, force: true })
})

test('packages runtime assets and removes stale files on clean and watch builds', async () => {
  fixture = await fs.mkdtemp(join(tmpdir(), 'bookmark-dist-'))
  const pages = ['index', 'tags', 'folders', 'groups', 'editBookmark', 'bookmarkManager']
  const files = {
    'manifest.json': '{"manifest_version":3}',
    'popup/js/initSearch.js': 'source module',
    'popup/js/initSearch.bundle.min.js': 'bundled runtime',
    'popup/js/initSearch.bundle.min.js.map': 'debug sources',
    'popup/js/model/source.js': 'bundled source module',
    'popup/js/__tests__/source.test.js': 'test source',
    'popup/mockData/data.json': 'mock data',
    'popup/lib/library.min.js': 'third-party runtime',
    'popup/lib/library.min.css': 'third-party styles',
    'popup/css/style.css': 'source styles',
    'popup/css/style.min.css': 'minified styles',
    'popup/css/shared.css': 'unbundled shared styles',
    'dist/chrome/popup/stale.txt': 'old popup asset',
    'dist/stale.txt': 'old distribution asset',
  }
  for (const size of [16, 32, 48, 128]) files[`images/logo-${size}.png`] = 'icon'
  for (const page of pages) {
    files[`popup/${page}.html`] =
      '<link rel="stylesheet" href="./css/style.css" /><script type="module" src="./js/initSearch.js"></script>'
  }
  await Promise.all(
    Object.entries(files).map(async ([path, content]) => {
      const target = join(fixture, path)
      await fs.mkdir(dirname(target), { recursive: true })
      await fs.writeFile(target, content)
    }),
  )

  await run(process.execPath, [fileURLToPath(script)], { cwd: fixture })
  const popup = join(fixture, 'dist/chrome/popup')
  expect(await fs.readdir(join(popup, 'js'))).toEqual(['initSearch.bundle.min.js'])
  expect(await fs.readdir(join(popup, 'css'))).toEqual(['shared.css', 'style.min.css'])
  expect(await fs.readFile(join(popup, 'lib/library.min.js'), 'utf8')).toBe('third-party runtime')
  expect(await fs.stat(join(popup, 'lib/library.min.css'))).toBeDefined()
  await expect(fs.access(join(popup, 'mockData'))).rejects.toMatchObject({ code: 'ENOENT' })
  await expect(fs.access(join(fixture, 'dist/stale.txt'))).rejects.toMatchObject({ code: 'ENOENT' })
  for (const page of pages) {
    const html = await fs.readFile(join(popup, `${page}.html`), 'utf8')
    expect(html).toContain('href="./css/style.min.css"')
    expect(html).toContain('<script defer src="./js/initSearch.bundle.min.js"></script>')
  }
  expect((await fs.stat(join(fixture, 'dist/chrome.zip'))).size).toBeGreaterThan(0)
  expect(await fs.readFile(join(fixture, 'popup/js/initSearch.bundle.min.js.map'), 'utf8')).toBe('debug sources')

  await fs.writeFile(join(popup, 'stale.txt'), 'removed during watch build')
  await fs.writeFile(join(fixture, 'dist/watch.txt'), 'preserved during watch build')
  await run(
    process.execPath,
    ['--input-type=module', '-e', `import { createDist } from '${script.href}'\nawait createDist(false)`],
    { cwd: fixture },
  )
  await expect(fs.access(join(popup, 'stale.txt'))).rejects.toMatchObject({ code: 'ENOENT' })
  expect(await fs.readFile(join(fixture, 'dist/watch.txt'), 'utf8')).toBe('preserved during watch build')
})
