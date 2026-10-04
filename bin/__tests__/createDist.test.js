import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import * as fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { afterEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

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
  assert.deepStrictEqual(await fs.readdir(join(popup, 'js')), ['initSearch.bundle.min.js'])
  assert.deepStrictEqual(await fs.readdir(join(popup, 'css')), ['shared.css', 'style.min.css'])
  assert.strictEqual(await fs.readFile(join(popup, 'lib/library.min.js'), 'utf8'), 'third-party runtime')
  assert.notStrictEqual(await fs.stat(join(popup, 'lib/library.min.css')), undefined)
  await assert.rejects(fs.access(join(popup, 'mockData')), { code: 'ENOENT' })
  await assert.rejects(fs.access(join(fixture, 'dist/stale.txt')), { code: 'ENOENT' })
  for (const page of pages) {
    const html = await fs.readFile(join(popup, `${page}.html`), 'utf8')
    assert(html.includes('href="./css/style.min.css"'))
    assert(html.includes('<script defer src="./js/initSearch.bundle.min.js"></script>'))
  }
  assert((await fs.stat(join(fixture, 'dist/chrome.zip'))).size > 0)
  assert.strictEqual(await fs.readFile(join(fixture, 'popup/js/initSearch.bundle.min.js.map'), 'utf8'), 'debug sources')
  await fs.writeFile(join(popup, 'stale.txt'), 'removed during watch build')
  await fs.writeFile(join(fixture, 'dist/watch.txt'), 'preserved during watch build')
  await run(
    process.execPath,
    ['--input-type=module', '-e', `import { createDist } from '${script.href}'\nawait createDist(false)`],
    { cwd: fixture },
  )
  await assert.rejects(fs.access(join(popup, 'stale.txt')), { code: 'ENOENT' })
  assert.strictEqual(await fs.readFile(join(fixture, 'dist/watch.txt'), 'utf8'), 'preserved during watch build')
})
