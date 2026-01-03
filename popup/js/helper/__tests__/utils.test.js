import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { cleanUpUrl, escapeHtml, generateRandomId, loadScript, timeSince } from '../utils.js'

describe('generateRandomId', () => {
  it('returns a deterministic identifier prefixed with R', () => {
    expect(generateRandomId()).toMatch(/^R\d+$/)
  })

  it('increments the numeric portion on each call', () => {
    const first = generateRandomId()
    const second = generateRandomId()
    const firstNumeric = Number(first.slice(1))
    const secondNumeric = Number(second.slice(1))

    expect(secondNumeric).toBe(firstNumeric + 1)
  })
})

describe('cleanUpUrl', () => {
  it('normalizes protocol, www and trailing slash', () => {
    expect(cleanUpUrl('https://www.Example.com/')).toBe('example.com')
  })

  it('leaves hostname and path intact', () => {
    expect(cleanUpUrl('http://docs.example.com/path/to/page')).toBe('docs.example.com/path/to/page')
  })

  it('converts to lowercase', () => {
    expect(cleanUpUrl('HTTPS://WWW.EXAMPLE.COM/')).toBe('example.com')
  })

  it('handles URLs with paths', () => {
    expect(cleanUpUrl('https://www.example.com/path/to/resource')).toBe('example.com/path/to/resource')
  })

  it('handles URLs with query parameters', () => {
    expect(cleanUpUrl('https://www.example.com/search?q=test')).toBe('example.com/search?q=test')
  })

  it('handles URLs with fragments', () => {
    expect(cleanUpUrl('https://www.example.com/page#section')).toBe('example.com/page')
  })

  it('handles edge cases gracefully', () => {
    expect(cleanUpUrl('')).toBe('')
    expect(cleanUpUrl(null)).toBe('')
    expect(cleanUpUrl(undefined)).toBe('')
  })

  it('handles URLs without protocol or www', () => {
    expect(cleanUpUrl('example.com')).toBe('example.com')
  })

  it('handles complex URLs', () => {
    expect(cleanUpUrl('HTTPS://WWW.SUBDOMAIN.EXAMPLE.CO.UK/PATH/TO/RESOURCE?QUERY=VALUE#FRAGMENT')).toBe(
      'subdomain.example.co.uk/path/to/resource?query=value',
    )
  })

  it('handles international domains and unicode characters', () => {
    expect(cleanUpUrl('https://www.münchen.de/')).toBe('münchen.de')
    expect(cleanUpUrl('https://例え.テスト/')).toBe('例え.テスト')
  })
})

describe('timeSince', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2024-01-01T12:00:00Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('returns seconds for very recent times', () => {
    const thirtySecondsAgo = new Date('2024-01-01T11:59:30Z')
    expect(timeSince(thirtySecondsAgo)).toBe('30 s')

    const oneSecondAgo = new Date('2024-01-01T11:59:59Z')
    expect(timeSince(oneSecondAgo)).toBe('1 s')
  })

  it('returns minutes for times less than an hour', () => {
    const thirtyMinutesAgo = new Date('2024-01-01T11:30:00Z')
    expect(timeSince(thirtyMinutesAgo)).toBe('30 m')
  })

  it('returns hours for times less than a day', () => {
    const twelveHoursAgo = new Date('2024-01-01T00:00:00Z')
    expect(timeSince(twelveHoursAgo)).toBe('12 h')
  })

  it('returns days for times less than a month', () => {
    const tenDaysAgo = new Date('2023-12-22T12:00:00Z')
    expect(timeSince(tenDaysAgo)).toBe('10 d')
  })

  it('returns months for times less than a year', () => {
    const sixMonthsAgo = new Date('2023-07-01T12:00:00Z')
    expect(timeSince(sixMonthsAgo)).toBe('6 month')
  })

  it('returns years for times more than a year', () => {
    const twoYearsAgo = new Date('2022-01-01T12:00:00Z')
    expect(timeSince(twoYearsAgo)).toBe('2 year')
  })

  it('handles boundary conditions correctly', () => {
    // Test minute boundary: 59 seconds = "59 s", 61 seconds = "1 m"
    expect(timeSince(new Date('2024-01-01T11:59:01Z'))).toBe('59 s')
    expect(timeSince(new Date('2024-01-01T11:58:59Z'))).toBe('1 m')

    // Test hour boundary: 59 minutes = "59 m", 61 minutes = "1 h"
    expect(timeSince(new Date('2024-01-01T11:01:00Z'))).toBe('59 m')
    expect(timeSince(new Date('2024-01-01T10:59:00Z'))).toBe('1 h')

    // Test day boundary: 23 hours = "0 s", 25 hours = "1 d"
    expect(timeSince(new Date('2024-01-01T13:00:00Z'))).toBe('0 s')
    expect(timeSince(new Date('2023-12-31T11:00:00Z'))).toBe('1 d')
  })

  it('handles edge cases', () => {
    // Future dates
    expect(timeSince(new Date('2024-01-02T12:00:00Z'))).toBe('0 s')

    // Invalid inputs
    expect(timeSince('invalid')).toBe('Invalid date')
    expect(timeSince(null)).toBe('Invalid date')
    expect(timeSince(undefined)).toBe('Invalid date')
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
      onload: jest.fn(),
      onerror: jest.fn(),
      src: '',
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }

    mockHead = {
      appendChild: jest.fn(),
    }

    // Mock document methods
    document.createElement = jest.fn().mockReturnValue(mockScript)
    document.getElementsByTagName = jest.fn().mockReturnValue([mockHead])
  })

  afterEach(() => {
    jest.restoreAllMocks()
    document.createElement = originalCreateElement
    document.getElementsByTagName = originalGetElementsByTagName
  })

  it('loads a script successfully with correct DOM manipulation', async () => {
    const url = 'https://example.com/script.js'

    const loadPromise = loadScript(url)
    mockScript.onload()
    await expect(loadPromise).resolves.toBeUndefined()

    expect(document.createElement).toHaveBeenCalledWith('script')
    expect(mockScript.type).toBe('text/javascript')
    expect(mockScript.src).toBe(url)
    expect(mockHead.appendChild).toHaveBeenCalledWith(mockScript)
  })

  it('caches loaded scripts and skips DOM manipulation on second call', async () => {
    const url = 'https://example.com/script.js'

    // First call
    const firstPromise = loadScript(url)
    mockScript.onload()
    await expect(firstPromise).resolves.toBeUndefined()

    // Reset mocks to track second call
    jest.clearAllMocks()

    // Second call should return immediately without DOM manipulation
    const secondPromise = loadScript(url)
    await expect(secondPromise).resolves.toBeUndefined()

    // Should not create or append script on second call (cached)
    expect(document.createElement).not.toHaveBeenCalled()
    expect(mockHead.appendChild).not.toHaveBeenCalled()
  })

  it('rejects when script fails to load and retries create element on next call', async () => {
    const url = 'https://example.com/fail.js'

    const loadPromise = loadScript(url)
    mockScript.onerror()

    await expect(loadPromise).rejects.toThrow(`Failed to load script: ${url}`)

    jest.clearAllMocks()

    const retryPromise = loadScript(url)
    mockScript.onload()
    await expect(retryPromise).resolves.toBeUndefined()

    expect(document.createElement).toHaveBeenCalledWith('script')
    expect(mockHead.appendChild).toHaveBeenCalledWith(mockScript)
  })

  it('handles multiple different script URLs correctly', async () => {
    // Load first script
    const firstPromise = loadScript('https://example.com/script1.js')
    mockScript.onload()
    await expect(firstPromise).resolves.toBeUndefined()

    // Reset mocks for second script
    jest.clearAllMocks()

    // Load second script with different URL
    const secondPromise = loadScript('https://cdn.example.com/script2.js')
    mockScript.onload()
    await expect(secondPromise).resolves.toBeUndefined()

    // Should create and append script for second script
    expect(document.createElement).toHaveBeenCalledTimes(1)
    expect(mockHead.appendChild).toHaveBeenCalledTimes(1)
  })
})

describe('escapeHtml', () => {
  it('escapes all special characters', () => {
    expect(escapeHtml('<script>"test"&\'')).toBe('&lt;script&gt;&quot;test&quot;&amp;&#39;')
  })

  it('handles nullish values gracefully', () => {
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
  })

  it('leaves plain text untouched', () => {
    expect(escapeHtml('plain text')).toBe('plain text')
  })
})
