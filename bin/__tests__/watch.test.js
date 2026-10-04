import assert from 'node:assert/strict'
import { fork } from 'node:child_process'
import { once } from 'node:events'
import * as fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout } from 'node:timers/promises'

test('watches nested sources, coalesces saves, ignores generated assets, and closes on SIGTERM', async (t) => {
  const fixture = await fs.mkdtemp(join(tmpdir(), 'bookmark-watch-'))
  t.after(() => fs.rm(fixture, { recursive: true, force: true }))
  await fs.mkdir(join(fixture, 'popup/nested'), { recursive: true })
  await fs.mkdir(join(fixture, 'popup/lib'), { recursive: true })
  await fs.writeFile(join(fixture, 'package.json'), '{"type":"module"}')
  await fs.copyFile(new URL('../watch.js', import.meta.url), join(fixture, 'watch.js'))
  await fs.writeFile(join(fixture, 'bundle.js'), 'export async function bundleAll() {}')
  await fs.writeFile(join(fixture, 'createDist.js'), 'export async function createDist() {}')
  await fs.writeFile(
    join(fixture, 'syncDevDist.js'),
    `import { readFile } from 'node:fs/promises'
export async function syncDevDist() {
  process.send({ source: await readFile('popup/nested/source.js', 'utf8').catch(() => null) })
}`,
  )
  const source = join(fixture, 'popup/nested/source.js')
  await fs.writeFile(source, 'initial')
  const child = fork(join(fixture, 'watch.js'), {
    cwd: fixture,
    execArgv: [],
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  })
  let output = ''
  child.stdout.on('data', (data) => {
    output += data
  })
  child.stderr.on('data', (data) => {
    output += data
  })
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit')
      child.kill('SIGTERM')
      await exited
    }
  })
  let builds = 0
  child.on('message', () => builds++)
  const nextBuild = async () => {
    const [message] = await once(child, 'message', { signal: AbortSignal.timeout(1500) }).catch((error) => {
      throw new Error(`Watcher did not rebuild:\n${output}`, { cause: error })
    })
    return message.source
  }

  assert.strictEqual(await nextBuild(), 'initial')

  const saved = nextBuild()
  await fs.writeFile(source, 'partial')
  await setTimeout(100)
  await fs.writeFile(source, 'saved')
  assert.strictEqual(await saved, 'saved')
  await setTimeout(350)
  assert.strictEqual(builds, 2, output)

  await Promise.all(
    [
      'lib/library.js',
      'lib/library.css',
      'nested/source.min.js',
      'nested/source.min.js.map',
      'nested/style.min.css',
    ].map((path) => fs.writeFile(join(fixture, 'popup', path), 'generated')),
  )
  await setTimeout(350)
  assert.strictEqual(builds, 2, output)

  const replaced = nextBuild()
  const replacement = join(fixture, 'replacement.js')
  await fs.writeFile(replacement, 'replacement')
  await fs.rename(replacement, source)
  assert.strictEqual(await replaced, 'replacement')

  const edited = nextBuild()
  await fs.writeFile(source, 'edited after replacement')
  assert.strictEqual(await edited, 'edited after replacement')

  const removed = nextBuild()
  await fs.rm(source)
  assert.strictEqual(await removed, null)

  const added = nextBuild()
  await fs.mkdir(join(fixture, 'popup/new-directory'))
  await fs.writeFile(join(fixture, 'popup/new-directory/new.js'), 'new source')
  assert.strictEqual(await added, null)

  const nestedEdit = nextBuild()
  await fs.writeFile(join(fixture, 'popup/new-directory/new.js'), 'edited new source')
  assert.strictEqual(await nestedEdit, null)

  const exited = once(child, 'exit')
  child.kill('SIGTERM')
  const [code, signal] = await exited
  assert.strictEqual(code, 0, output)
  assert.strictEqual(signal, null)
})
