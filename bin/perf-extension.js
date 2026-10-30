#!/usr/bin/env node

/**
 * @file Measures popup startup and search latency in a real Chromium extension.
 *
 * Loads one or more unpacked extension builds into a persistent Chromium profile,
 * seeds that profile with bookmarks and history through the real browser APIs, and
 * opens the popup page repeatedly. Unlike the jsdom benchmarks, this includes HTML
 * parsing, script evaluation, browser API latency, layout, and paint.
 *
 * Several `--extension` directories are measured in interleaved runs inside the same
 * browser, so A/B comparisons share the same profile, data, and machine noise.
 * Seeding only adds data, so a profile directory can be reused across runs and builds.
 * Pass the generated profile directory only; seeding would write into any other profile.
 *
 * Usage:
 *   npm run build && npm run test:perf:browser
 *   node bin/perf-extension.js --extension dist/chrome --extension ../other/dist/chrome
 *   node bin/perf-extension.js --history-max-items 10000 --search-strategy fuzzy
 *   node bin/perf-extension.js --profile reports/perf-profile-20k --bookmarks 20000 --history 40000
 */

import { existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { parseArgs } from 'node:util'
import { chromium } from '@playwright/test'

const { values } = parseArgs({
  options: {
    extension: { type: 'string', multiple: true },
    profile: { type: 'string', default: 'reports/perf-extension-profile' },
    runs: { type: 'string', default: '15' },
    bookmarks: { type: 'string', default: '5000' },
    history: { type: 'string', default: '10000' },
    'history-max-items': { type: 'string' },
    'history-days-ago': { type: 'string' },
    'search-strategy': { type: 'string', default: 'precise' },
    headed: { type: 'boolean', default: false },
  },
})

const extensionDirs = (values.extension?.length ? values.extension : ['dist/chrome']).map((dir) => resolve(dir))
for (const dir of extensionDirs) {
  if (!existsSync(join(dir, 'manifest.json'))) {
    console.error(`No extension build found at ${dir}. Run \`npm run build\` first.`)
    process.exit(1)
  }
}
const profileDir = resolve(values.profile)
const runs = Number(values.runs)
const bookmarkCount = Number(values.bookmarks)
const historyCount = Number(values.history)
const userOptions = {}
if (values['history-max-items']) userOptions.historyMaxItems = Number(values['history-max-items'])
if (values['history-days-ago']) userOptions.historyDaysAgo = Number(values['history-days-ago'])
const defaultStrategy = values['search-strategy']
const otherStrategy = defaultStrategy === 'fuzzy' ? 'precise' : 'fuzzy'
userOptions.searchStrategy = defaultStrategy

const TYPED_TERM = 'github docs'
const TYPING_PHRASE = 'react performance guide'
const WORDS = [
  'react',
  'performance',
  'guide',
  'javascript',
  'browser',
  'extension',
  'search',
  'docs',
  'api',
  'testing',
  'design',
  'release',
  'notes',
  'tutorial',
  'kubernetes',
  'database',
  'security',
  'café',
  'monitoring',
  'news',
]
const DOMAINS = ['github.com', 'developer.mozilla.org', 'stackoverflow.com', 'news.example.com', 'docs.example.org']
const OPEN_TABS = 12

/**
 * Records browser API calls, paint, and result rendering relative to navigation start.
 * Runs in the popup page before any extension script.
 */
function instrumentPopup(typedTerm) {
  const perf = { calls: [], firstResultsAt: null, initDoneAt: null, typedResultsAt: null, historyRenderedAt: null }
  window.__perf = perf

  const wrap = (namespace, method) => {
    const target = globalThis.chrome?.[namespace]
    const original = target?.[method]
    if (typeof original !== 'function') return
    target[method] = (...args) => {
      const entry = { api: `${namespace}.${method}`, start: performance.now() }
      perf.calls.push(entry)
      const finish = (result) => {
        entry.end = performance.now()
        if (Array.isArray(result)) entry.count = result.length
        return result
      }
      if (typeof args.at(-1) === 'function') {
        const callback = args.pop()
        return original.call(target, ...args, (...result) => {
          finish(result[0])
          callback(...result)
        })
      }
      return original.call(target, ...args).then(finish)
    }
  }
  wrap('tabs', 'query')
  wrap('tabGroups', 'query')
  wrap('bookmarks', 'getTree')
  wrap('history', 'search')
  const sync = globalThis.chrome?.storage?.sync
  if (sync) {
    const originalGet = sync.get
    sync.get = (...args) => {
      const entry = { api: 'storage.sync.get', start: performance.now() }
      perf.calls.push(entry)
      const callback = typeof args.at(-1) === 'function' ? args.pop() : null
      if (callback) {
        return originalGet.call(sync, ...args, (...result) => {
          entry.end = performance.now()
          callback(...result)
        })
      }
      return originalGet.call(sync, ...args).then((result) => {
        entry.end = performance.now()
        return result
      })
    }
  }

  new MutationObserver(() => {
    const list = document.getElementById('results')
    if (!list) return
    const now = performance.now()
    if (perf.initDoneAt === null && !document.getElementById('results-load')) perf.initDoneAt = now
    if (perf.firstResultsAt === null && list.querySelector('li[x-index]')) perf.firstResultsAt = now
    if (perf.historyRenderedAt === null && window.ext?.model?.history?.length && list.querySelector('li[x-index]')) {
      perf.historyRenderedAt = now
    }
    if (
      typedTerm &&
      perf.typedResultsAt === null &&
      window.ext?.model?.searchTerm === typedTerm &&
      list.querySelector('li[x-index]')
    ) {
      perf.typedResultsAt = now
    }
  }).observe(document, { childList: true, subtree: true })

  if (typedTerm) {
    // Simulate a user who starts typing as soon as the search field exists.
    document.addEventListener('DOMContentLoaded', () => {
      const input = document.getElementById('q')
      perf.typedAt = performance.now()
      input.value = typedTerm
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }
}

/** Rejects once a page logs an error, so a broken build fails fast instead of timing out. */
const pageFailures = new WeakMap()

/** Open the instrumented popup in a new tab. */
async function openPopup(context, url, typedTerm) {
  const page = await context.newPage()
  const failure = new Promise((_resolve, reject) => {
    page.on('pageerror', reject)
    page.on('console', (message) => {
      if (message.type() === 'error') reject(new Error(`Popup error: ${message.text()}`))
    })
  })
  failure.catch(() => {})
  pageFailures.set(page, failure)
  await page.addInitScript(instrumentPopup, typedTerm)
  await page.goto(url)
  return page
}

/** Collect one run's metrics once the popup finished its startup work. */
async function collectStartupMetrics(page, typed) {
  await Promise.race([
    pageFailures.get(page),
    page.waitForFunction(
      (typedRun) =>
        window.__perf.initDoneAt !== null &&
        window.__perf.historyRenderedAt !== null &&
        (!typedRun || window.__perf.typedResultsAt !== null),
      typed,
      { timeout: 30000 },
    ),
  ])
  return page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0]
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]
    const perf = window.__perf
    const api = {}
    for (const call of perf.calls) {
      api[call.api] ??= { start: call.start, end: call.end, count: call.count }
    }
    return {
      domContentLoaded: nav.domContentLoadedEventEnd,
      load: nav.loadEventEnd,
      fcp: fcp?.startTime ?? null,
      api,
      firstResults: perf.firstResultsAt,
      initDone: perf.initDoneAt,
      historyRendered: perf.historyRenderedAt,
      typedResults: perf.typedResultsAt,
    }
  })
}

/**
 * Measure per-keystroke main-thread cost on fully loaded data.
 *
 * Adds the synchronous input handling (search and DOM render) to the next rendering update
 * (style, layout, paint recording). The rendering update is timed from the animation frame
 * callback to a task posted from it, which excludes idle time spent waiting for vsync.
 * A forced synchronous layout would undercount `content-visibility: auto` content, whose
 * visibility is only decided during the rendering update.
 */
async function measureTyping(page, strategy) {
  return page.evaluate(
    async ({ phrase, searchStrategy }) => {
      const measureRenderingUpdate = () =>
        new Promise((resolveFrame) =>
          requestAnimationFrame(() => {
            const frameStart = performance.now()
            const channel = new MessageChannel()
            channel.port1.onmessage = () => resolveFrame(performance.now() - frameStart)
            channel.port2.postMessage(null)
          }),
        )
      const input = document.getElementById('q')
      window.ext.opts.searchStrategy = searchStrategy
      window.ext.searchCache?.clear()
      const samples = []
      for (let i = 1; i <= phrase.length; i++) {
        const start = performance.now()
        input.value = phrase.slice(0, i)
        input.dispatchEvent(new Event('input', { bubbles: true }))
        await window.ext.model.activeSearchPromise
        const scriptMs = performance.now() - start
        samples.push(scriptMs + (await measureRenderingUpdate()))
      }
      input.value = ''
      return samples
    },
    { phrase: TYPING_PHRASE, searchStrategy: strategy },
  )
}

function median(values) {
  const sorted = values.filter((value) => value != null).sort((a, b) => a - b)
  if (!sorted.length) return null
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function percentile(values, p) {
  const sorted = values.filter((value) => value != null).sort((a, b) => a - b)
  if (!sorted.length) return null
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]
}

const format = (value) => (value == null ? 'N/A' : `${value.toFixed(1)}ms`)

async function getExtensionIds(context) {
  const page = await context.newPage()
  await page.goto('chrome://extensions')
  const infos = await page.evaluate(() => chrome.developerPrivate.getExtensionsInfo())
  await page.close()
  return extensionDirs.map((dir) => {
    const info = infos.find((entry) => resolve(entry.path).toLowerCase() === dir.toLowerCase())
    if (!info) throw new Error(`Extension at ${dir} was not loaded`)
    return info.id
  })
}

/** Create bookmarks and history in the profile once; later runs reuse them. */
async function seedProfile(page) {
  return page.evaluate(
    async ({ bookmarks, history, words, domains }) => {
      const pick = (i, offset) => words[(i * 7 + offset * 13) % words.length]
      const countBookmarks = (nodes) =>
        nodes.reduce((sum, node) => sum + (node.url ? 1 : 0) + countBookmarks(node.children || []), 0)
      let existing = countBookmarks(await chrome.bookmarks.getTree())
      const folders = []
      if (existing < bookmarks) {
        for (let f = 0; f < 40; f++) {
          const folder = await chrome.bookmarks.create({ parentId: '1', title: `${pick(f, 1)} ${f}` })
          const sub = await chrome.bookmarks.create({ parentId: folder.id, title: `${pick(f, 2)} archive` })
          folders.push(folder.id, sub.id)
        }
      }
      const pending = []
      for (let i = existing; i < bookmarks; i++) {
        const tags = i % 4 === 0 ? ` #${pick(i, 3)} #${pick(i, 4)}` : ''
        pending.push(
          chrome.bookmarks.create({
            parentId: folders[i % folders.length],
            title: `${pick(i, 0)} ${pick(i, 5)} ${pick(i, 6)} ${i}${tags}`,
            url: `https://${domains[i % domains.length]}/${pick(i, 7)}/${pick(i, 8)}-${i}`,
          }),
        )
        if (pending.length === 200) await Promise.all(pending.splice(0))
      }
      await Promise.all(pending)
      existing = Math.max(existing, bookmarks)

      const existingHistory = (await chrome.history.search({ text: '', startTime: 0, maxResults: history })).length
      const historyPending = []
      for (let i = existingHistory; i < history; i++) {
        historyPending.push(
          chrome.history.addUrl({ url: `https://${domains[(i + 2) % domains.length]}/h/${pick(i, 9)}/${i}` }),
        )
        if (historyPending.length === 200) await Promise.all(historyPending.splice(0))
      }
      await Promise.all(historyPending)
      return {
        bookmarks: countBookmarks(await chrome.bookmarks.getTree()),
        history: (await chrome.history.search({ text: '', startTime: 0, maxResults: history * 2 })).length,
      }
    },
    { bookmarks: bookmarkCount, history: historyCount, words: WORDS, domains: DOMAINS },
  )
}

async function main() {
  mkdirSync(profileDir, { recursive: true })
  const context = await chromium.launchPersistentContext(profileDir, {
    channel: 'chromium',
    headless: !values.headed,
    viewport: { width: 515, height: 600 },
    args: [`--disable-extensions-except=${extensionDirs.join(',')}`, `--load-extension=${extensionDirs.join(',')}`],
  })

  try {
    const ids = await getExtensionIds(context)
    const setupPage = await context.newPage()
    await setupPage.goto(`chrome-extension://${ids[0]}/popup/index.html`)
    const seeded = await seedProfile(setupPage)
    await setupPage.close()
    console.log(`Profile: ${seeded.bookmarks} bookmarks, ${seeded.history} history entries`)

    // Open regular web tabs (served locally) so the popup renders its default recent-tab results.
    await context.route(/^https?:\/\//, (route) =>
      route.fulfill({ contentType: 'text/html', body: `<title>Open tab ${route.request().url()}</title>` }),
    )
    for (let i = 0; i < OPEN_TABS; i++) {
      const tab = await context.newPage()
      await tab.goto(`https://${DOMAINS[i % DOMAINS.length]}/open/${WORDS[i % WORDS.length]}-${i}`)
    }

    for (const id of ids) {
      const page = await context.newPage()
      await page.goto(`chrome-extension://${id}/popup/index.html`)
      await page.evaluate((options) => chrome.storage.sync.set({ userOptions: options }), userOptions)
      await page.close()
    }

    const results = ids.map(() => ({
      idle: [],
      typed: [],
      typing: { precise: [], fuzzy: [] },
      firstKey: { precise: [], fuzzy: [] },
    }))

    // Warm up the browser's disk caches and extension process once per build.
    for (const id of ids) {
      const page = await openPopup(context, `chrome-extension://${id}/popup/index.html`, null)
      await collectStartupMetrics(page, false)
      await page.close()
    }

    for (let run = 0; run < runs; run++) {
      for (let i = 0; i < ids.length; i++) {
        const url = `chrome-extension://${ids[i]}/popup/index.html`

        const idlePage = await openPopup(context, url, null)
        results[i].idle.push(await collectStartupMetrics(idlePage, false))
        // The default strategy types first, on a cold page; the other one measures switching strategies.
        for (const strategy of [defaultStrategy, otherStrategy]) {
          const [firstKey, ...rest] = await measureTyping(idlePage, strategy)
          results[i].firstKey[strategy].push(firstKey)
          results[i].typing[strategy].push(...rest)
        }
        await idlePage.close()

        const typedPage = await openPopup(context, url, TYPED_TERM)
        results[i].typed.push(await collectStartupMetrics(typedPage, true))
        await typedPage.close()
      }
    }

    printReport(results, seeded)
  } finally {
    await context.close()
  }
}

function printReport(results, seeded) {
  const labels = extensionDirs.map((_dir, i) => `#${i + 1}`)
  console.log('')
  extensionDirs.forEach((dir, i) => {
    console.log(`${labels[i]}: ${dir}`)
  })
  console.log(
    `\n### Real Browser Popup Performance (${seeded.bookmarks} bookmarks, ${seeded.history} history, ${runs} runs, median)\n`,
  )
  console.log(`| Metric | ${labels.join(' | ')} |`)
  console.log(`|---|${labels.map(() => '---').join('|')}|`)

  const apiNames = [...new Set(results.flatMap((result) => result.idle.flatMap((run) => Object.keys(run.api))))].sort()
  const rows = [
    ['First contentful paint', (r) => r.idle.map((run) => run.fcp)],
    ['DOMContentLoaded', (r) => r.idle.map((run) => run.domContentLoaded)],
    ['Load event', (r) => r.idle.map((run) => run.load)],
    ...apiNames.flatMap((name) => [
      [`${name} start`, (r) => r.idle.map((run) => run.api[name]?.start)],
      [`${name} duration`, (r) => r.idle.map((run) => run.api[name] && run.api[name].end - run.api[name].start)],
    ]),
    ['Default results rendered', (r) => r.idle.map((run) => run.firstResults)],
    ['Startup finished', (r) => r.idle.map((run) => run.initDone)],
    ['Results rendered with history', (r) => r.idle.map((run) => run.historyRendered)],
    [`Results for "${TYPED_TERM}" typed at DOMContentLoaded`, (r) => r.typed.map((run) => run.typedResults)],
    [`Results for "${TYPED_TERM}" with history`, (r) => r.typed.map((run) => run.historyRendered)],
    [`First keystroke "${TYPING_PHRASE[0]}", ${defaultStrategy} (default, cold)`, (r) => r.firstKey[defaultStrategy]],
    [`First keystroke "${TYPING_PHRASE[0]}", ${otherStrategy} (after switching)`, (r) => r.firstKey[otherStrategy]],
    ['Later keystrokes, precise', (r) => r.typing.precise],
    ['Later keystrokes, fuzzy', (r) => r.typing.fuzzy],
  ]
  for (const [label, getValues] of rows) {
    console.log(`| ${label} | ${results.map((result) => format(median(getValues(result)))).join(' | ')} |`)
  }
  console.log(
    `| Later keystrokes, precise (p90) | ${results.map((r) => format(percentile(r.typing.precise, 90))).join(' | ')} |`,
  )
  console.log(
    `| Later keystrokes, fuzzy (p90) | ${results.map((r) => format(percentile(r.typing.fuzzy, 90))).join(' | ')} |`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
