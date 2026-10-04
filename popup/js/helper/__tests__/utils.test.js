import '../../../../test/setup.js'
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'
import { matches } from '../../../../test/patterns.js'
import {
  cleanUpUrl,
  escapeHtml,
  escapeRegex,
  generateRandomId,
  highlightMatches,
  highlightRegexMatches,
  loadScript,
  timeSince,
} from '../utils.js'

describe('generateRandomId', () => {
  it('returns a deterministic identifier prefixed with R', () => {
    assert.match(generateRandomId(), /^R\d+$/)
  })
  it('increments the numeric portion on each call', () => {
    const first = generateRandomId()
    const second = generateRandomId()
    const firstNumeric = Number(first.slice(1))
    const secondNumeric = Number(second.slice(1))
    assert.strictEqual(secondNumeric, firstNumeric + 1)
  })
})
describe('cleanUpUrl', () => {
  it('normalizes protocol, www and trailing slash', () => {
    assert.strictEqual(cleanUpUrl('https://www.Example.com/'), 'example.com')
  })
  it('leaves hostname and path intact', () => {
    assert.strictEqual(cleanUpUrl('http://docs.example.com/path/to/page'), 'docs.example.com/path/to/page')
  })
  it('converts to lowercase', () => {
    assert.strictEqual(cleanUpUrl('HTTPS://WWW.EXAMPLE.COM/'), 'example.com')
  })
  it('handles URLs with paths', () => {
    assert.strictEqual(cleanUpUrl('https://www.example.com/path/to/resource'), 'example.com/path/to/resource')
  })
  it('handles URLs with query parameters', () => {
    assert.strictEqual(cleanUpUrl('https://www.example.com/search?q=test'), 'example.com/search?q=test')
  })
  it('handles URLs with fragments', () => {
    assert.strictEqual(cleanUpUrl('https://www.example.com/page#section'), 'example.com/page')
  })
  it('handles edge cases gracefully', () => {
    assert.strictEqual(cleanUpUrl(''), '')
    assert.strictEqual(cleanUpUrl(null), '')
    assert.strictEqual(cleanUpUrl(undefined), '')
  })
  it('handles URLs without protocol or www', () => {
    assert.strictEqual(cleanUpUrl('example.com'), 'example.com')
  })
  it('handles complex URLs', () => {
    assert.strictEqual(
      cleanUpUrl('HTTPS://WWW.SUBDOMAIN.EXAMPLE.CO.UK/PATH/TO/RESOURCE?QUERY=VALUE#FRAGMENT'),
      'subdomain.example.co.uk/path/to/resource?query=value',
    )
  })
  it('handles international domains and unicode characters', () => {
    assert.strictEqual(cleanUpUrl('https://www.münchen.de/'), 'münchen.de')
    assert.strictEqual(cleanUpUrl('https://例え.テスト/'), '例え.テスト')
  })
})
describe('timeSince', () => {
  beforeEach(() => {
    mock.timers.enable({
      apis: ['Date'],
    })
    mock.timers.setTime(new Date('2024-01-01T12:00:00Z').getTime())
  })
  afterEach(() => {
    mock.timers.reset()
  })
  it('returns seconds for very recent times', () => {
    const thirtySecondsAgo = new Date('2024-01-01T11:59:30Z')
    assert.strictEqual(timeSince(thirtySecondsAgo), '30 s')
    const oneSecondAgo = new Date('2024-01-01T11:59:59Z')
    assert.strictEqual(timeSince(oneSecondAgo), '1 s')
  })
  it('returns minutes for times less than an hour', () => {
    const thirtyMinutesAgo = new Date('2024-01-01T11:30:00Z')
    assert.strictEqual(timeSince(thirtyMinutesAgo), '30 m')
  })
  it('returns hours for times less than a day', () => {
    const twelveHoursAgo = new Date('2024-01-01T00:00:00Z')
    assert.strictEqual(timeSince(twelveHoursAgo), '12 h')
  })
  it('returns days for times less than a month', () => {
    const tenDaysAgo = new Date('2023-12-22T12:00:00Z')
    assert.strictEqual(timeSince(tenDaysAgo), '10 d')
  })
  it('returns months for times less than a year', () => {
    const sixMonthsAgo = new Date('2023-07-01T12:00:00Z')
    assert.strictEqual(timeSince(sixMonthsAgo), '6 month')
  })
  it('returns years for times more than a year', () => {
    const twoYearsAgo = new Date('2022-01-01T12:00:00Z')
    assert.strictEqual(timeSince(twoYearsAgo), '2 year')
  })
  it('handles boundary conditions correctly', () => {
    // Test minute boundary: 59 seconds = "59 s", 61 seconds = "1 m"
    assert.strictEqual(timeSince(new Date('2024-01-01T11:59:01Z')), '59 s')
    assert.strictEqual(timeSince(new Date('2024-01-01T11:58:59Z')), '1 m')

    // Test hour boundary: 59 minutes = "59 m", 61 minutes = "1 h"
    assert.strictEqual(timeSince(new Date('2024-01-01T11:01:00Z')), '59 m')
    assert.strictEqual(timeSince(new Date('2024-01-01T10:59:00Z')), '1 h')

    // Test day boundary: 23 hours = "0 s", 25 hours = "1 d"
    assert.strictEqual(timeSince(new Date('2024-01-01T13:00:00Z')), '0 s')
    assert.strictEqual(timeSince(new Date('2023-12-31T11:00:00Z')), '1 d')
  })
  it('handles edge cases', () => {
    // Future dates
    assert.strictEqual(timeSince(new Date('2024-01-02T12:00:00Z')), '0 s')

    // Invalid inputs
    assert.strictEqual(timeSince('invalid'), 'Invalid date')
    assert.strictEqual(timeSince(null), 'Invalid date')
    assert.strictEqual(timeSince(undefined), 'Invalid date')
  })
})
describe('loadScript', () => {
  let mockScript
  let mockHead
  const originalCreateElement = document.createElement
  const originalGetElementsByTagName = document.getElementsByTagName
  beforeEach(() => {
    // Mock DOM elements
    mockScript = {
      type: '',
      onload: mock.fn(),
      onerror: mock.fn(),
      src: '',
      addEventListener: mock.fn(),
      removeEventListener: mock.fn(),
    }
    mockHead = {
      appendChild: mock.fn(),
    }

    // Mock document methods
    document.createElement = mock.fn(() => mockScript)
    document.getElementsByTagName = mock.fn(() => [mockHead])
  })
  afterEach(() => {
    mock.restoreAll()
    document.createElement = originalCreateElement
    document.getElementsByTagName = originalGetElementsByTagName
  })
  it('loads a script successfully with correct DOM manipulation', async () => {
    const url = 'https://example.com/script.js'
    const loadPromise = loadScript(url)
    mockScript.onload()
    assert.strictEqual(await loadPromise, undefined)
    assert(document.createElement.mock.calls.some((call) => matches(call.arguments, ['script'])))
    assert.strictEqual(mockScript.type, 'text/javascript')
    assert.strictEqual(mockScript.src, url)
    assert(mockHead.appendChild.mock.calls.some((call) => matches(call.arguments, [mockScript])))
  })
  it('caches loaded scripts and skips DOM manipulation on second call', async () => {
    const url = 'https://example.com/script.js'

    // First call
    const firstPromise = loadScript(url)
    mockScript.onload()
    assert.strictEqual(await firstPromise, undefined)

    // Reset mocks to track second call
    document.createElement.mock.resetCalls()
    document.getElementsByTagName.mock.resetCalls()
    mockHead.appendChild.mock.resetCalls() // Second call should return immediately without DOM manipulation
    const secondPromise = loadScript(url)
    assert.strictEqual(await secondPromise, undefined)

    // Should not create or append script on second call (cached)
    assert(document.createElement.mock.callCount() === 0)
    assert(mockHead.appendChild.mock.callCount() === 0)
  })
  it('deduplicates concurrent loads for the same script while the first request is still pending', async () => {
    const url = 'https://example.com/concurrent.js'
    const createdScripts = []
    document.createElement = mock.fn(() => {
      const script = {
        type: '',
        onload: null,
        onerror: null,
        src: '',
      }
      createdScripts.push(script)
      return script
    })
    const firstLoad = loadScript(url)
    const secondLoad = loadScript(url)
    assert.strictEqual(secondLoad, firstLoad)
    assert.strictEqual(document.createElement.mock.callCount(), 1)
    assert.strictEqual(mockHead.appendChild.mock.callCount(), 1)
    createdScripts[0].onload()
    assert.deepStrictEqual(await Promise.all([firstLoad, secondLoad]), [undefined, undefined])
  })
  it('rejects when script fails to load and retries create element on next call', async () => {
    const url = 'https://example.com/fail.js'
    const loadPromise = loadScript(url)
    mockScript.onerror()
    await assert.rejects(loadPromise, new RegExp(RegExp.escape(`Failed to load script: ${url}`)))
    document.createElement.mock.resetCalls()
    document.getElementsByTagName.mock.resetCalls()
    mockHead.appendChild.mock.resetCalls()
    const retryPromise = loadScript(url)
    mockScript.onload()
    assert.strictEqual(await retryPromise, undefined)
    assert(document.createElement.mock.calls.some((call) => matches(call.arguments, ['script'])))
    assert(mockHead.appendChild.mock.calls.some((call) => matches(call.arguments, [mockScript])))
  })
  it('handles multiple different script URLs correctly', async () => {
    // Load first script
    const firstPromise = loadScript('https://example.com/script1.js')
    mockScript.onload()
    assert.strictEqual(await firstPromise, undefined)

    // Reset mocks for second script
    document.createElement.mock.resetCalls()
    document.getElementsByTagName.mock.resetCalls()
    mockHead.appendChild.mock.resetCalls() // Load second script with different URL
    const secondPromise = loadScript('https://cdn.example.com/script2.js')
    mockScript.onload()
    assert.strictEqual(await secondPromise, undefined)

    // Should create and append script for second script
    assert.strictEqual(document.createElement.mock.callCount(), 1)
    assert.strictEqual(mockHead.appendChild.mock.callCount(), 1)
  })
})
describe('escapeHtml', () => {
  it('escapes all special characters', () => {
    assert.strictEqual(escapeHtml('<script>"test"&\''), '&lt;script&gt;&quot;test&quot;&amp;&#39;')
  })
  it('handles nullish values gracefully', () => {
    assert.strictEqual(escapeHtml(null), '')
    assert.strictEqual(escapeHtml(undefined), '')
  })
  it('leaves plain text untouched', () => {
    assert.strictEqual(escapeHtml('plain text'), 'plain text')
  })
})
describe('escapeRegex', () => {
  it('escapes all regex special characters', () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: Testing literal curly braces, not template placeholders
    const chars = '.*+?^${}()|[]\\'
    assert.strictEqual(escapeRegex(chars), '\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\')
  })
  it('leaves other characters untouched', () => {
    assert.strictEqual(escapeRegex('abc-123'), 'abc-123')
  })
})
describe('highlightMatches', () => {
  it('escapes and highlights matching terms', () => {
    const text = 'Hello world, hello universe'
    const terms = ['hello', 'universe']
    assert.strictEqual(
      highlightMatches(text, terms),
      '<mark>Hello</mark> world, <mark>hello</mark> <mark>universe</mark>',
    )
  })
  it('handles empty text', () => {
    assert.strictEqual(highlightMatches('', ['test']), '')
  })
  it('handles empty terms', () => {
    assert.strictEqual(highlightMatches('text', []), 'text')
  })
  it('handles regex input directly', () => {
    const text = 'Foo Bar'
    const regex = /(Bar)/
    assert.strictEqual(highlightMatches(text, regex), 'Foo <mark>Bar</mark>')
  })
  it('escapes HTML in text matching', () => {
    const text = '<b>Bold</b>'
    const terms = ['Bold']
    assert.strictEqual(highlightMatches(text, terms), '&lt;b&gt;<mark>Bold</mark>&lt;/b&gt;')
  })
})
describe('highlightRegexMatches', () => {
  it('escapes text and highlights precompiled regex matches', () => {
    const regex = /(Bold)/gi
    assert.strictEqual(highlightRegexMatches('<b>Bold</b>', regex), '&lt;b&gt;<mark>Bold</mark>&lt;/b&gt;')
  })
  it('highlights all matches when the regex is global', () => {
    const regex = /(ab)/gi
    assert.strictEqual(highlightRegexMatches('AB ab', regex), '<mark>AB</mark> <mark>ab</mark>')
  })
})
