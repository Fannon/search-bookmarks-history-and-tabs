import { describe, expect, it, beforeEach, afterEach, jest } from '@jest/globals'
import { cleanUpUrl, timeSince, printError, loadScript, loadCSS } from '../utils.js'

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
    expect(cleanUpUrl('https://www.example.com/page#section')).toBe('example.com/page#section')
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
      'subdomain.example.co.uk/path/to/resource?query=value#fragment',
    )
  })

  it('handles international domains and unicode characters', () => {
    expect(cleanUpUrl('https://www.münchen.de/')).toBe('münchen.de')
    expect(cleanUpUrl('https://例え.テスト/')).toBe('例え.テスト')
  })
})

describe('Integration Tests', () => {
  it('timeSince and cleanUpUrl work together for realistic scenarios', () => {
    // Test realistic scenario: URL cleanup and time formatting
    const testUrl = 'HTTPS://WWW.EXAMPLE.COM/TEST?QUERY=VALUE'
    const cleanedUrl = cleanUpUrl(testUrl)

    // Simulate a timestamp from the past
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2024-01-01T12:00:00Z'))

    const pastDate = new Date('2024-01-01T11:30:00Z') // 30 minutes ago
    const timeStr = timeSince(pastDate)

    expect(cleanedUrl).toBe('example.com/test?query=value')
    expect(timeStr).toBe('30 minutes')

    jest.useRealTimers()
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
    expect(timeSince(thirtySecondsAgo)).toBe('30 seconds')
  })

  it('returns minutes for times less than an hour', () => {
    const thirtyMinutesAgo = new Date('2024-01-01T11:30:00Z')
    expect(timeSince(thirtyMinutesAgo)).toBe('30 minutes')
  })

  it('returns hours for times less than a day', () => {
    const twelveHoursAgo = new Date('2024-01-01T00:00:00Z')
    expect(timeSince(twelveHoursAgo)).toBe('12 hours')
  })

  it('returns days for times less than a month', () => {
    const tenDaysAgo = new Date('2023-12-22T12:00:00Z')
    expect(timeSince(tenDaysAgo)).toBe('10 days')
  })

  it('returns months for times less than a year', () => {
    const sixMonthsAgo = new Date('2023-07-01T12:00:00Z')
    expect(timeSince(sixMonthsAgo)).toBe('6 months')
  })

  it('returns years for times more than a year', () => {
    const twoYearsAgo = new Date('2022-01-01T12:00:00Z')
    expect(timeSince(twoYearsAgo)).toBe('2 years')
  })

  it('handles boundary conditions correctly', () => {
    // Test minute boundary: 59 seconds = "59 seconds", 61 seconds = "1 minutes"
    expect(timeSince(new Date('2024-01-01T11:59:01Z'))).toBe('59 seconds')
    expect(timeSince(new Date('2024-01-01T11:58:59Z'))).toBe('1 minutes')

    // Test hour boundary: 59 minutes = "59 minutes", 61 minutes = "1 hours"
    expect(timeSince(new Date('2024-01-01T11:01:00Z'))).toBe('59 minutes')
    expect(timeSince(new Date('2024-01-01T10:59:00Z'))).toBe('1 hours')

    // Test day boundary: 23 hours = "0 seconds", 25 hours = "1 days"
    expect(timeSince(new Date('2024-01-01T13:00:00Z'))).toBe('0 seconds')
    expect(timeSince(new Date('2023-12-31T11:00:00Z'))).toBe('1 days')
  })

  it('handles edge cases', () => {
    // Future dates
    expect(timeSince(new Date('2024-01-02T12:00:00Z'))).toBe('0 seconds')

    // Invalid inputs
    expect(timeSince('invalid')).toBe('Invalid date')
    expect(timeSince(null)).toBe('Invalid date')
    expect(timeSince(undefined)).toBe('Invalid date')
  })
})

describe('loadScript', () => {
  let mockScript
  let mockHead

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

describe('loadCSS', () => {
  let mockLink
  let mockHead

  beforeEach(() => {
    mockLink = {
      href: '',
      rel: '',
      type: '',
    }

    mockHead = {
      appendChild: jest.fn(),
    }

    document.createElement = jest.fn().mockReturnValue(mockLink)
    document.getElementsByTagName = jest.fn().mockReturnValue([mockHead])
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('loads CSS with correct link element properties', () => {
    const href = 'https://example.com/style.css'

    loadCSS(href)

    expect(document.createElement).toHaveBeenCalledWith('link')
    expect(mockLink.href).toBe(href)
    expect(mockLink.rel).toBe('stylesheet')
    expect(mockLink.type).toBe('text/css')
    expect(mockHead.appendChild).toHaveBeenCalledWith(mockLink)
  })
})

describe('printError', () => {
  beforeEach(() => {
    document.body.innerHTML = '<ul id="error-list"></ul>'
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('logs errors with text and updates DOM correctly', () => {
    const err = new Error('Something went wrong')

    printError(err, 'While loading data')

    const errorList = document.getElementById('error-list')
    expect(errorList.innerHTML).toContain('<b>Error</b>: While loading data')
    expect(errorList.innerHTML).toContain('<b>Error Message</b>: Something went wrong')
    expect(errorList.style.cssText).toBe('display: block;')
    expect(console.error).toHaveBeenCalledTimes(2)
  })

  it('handles error without text parameter', () => {
    const err = new Error('Something went wrong')

    printError(err)

    const errorList = document.getElementById('error-list')
    expect(errorList.innerHTML).not.toContain('<b>Error</b>:')
    expect(errorList.innerHTML).toContain('<b>Error Message</b>: Something went wrong')
    expect(errorList.style.cssText).toBe('display: block;')
  })

  it('handles stack traces correctly', () => {
    const err = new Error('Something went wrong')
    err.stack = 'Error: Something went wrong\n    at testFunction (test.js:10:5)'

    printError(err, 'Test error')

    const errorList = document.getElementById('error-list')
    expect(errorList.innerHTML).toContain('<b>Error Stack</b>: Error: Something went wrong')
  })

  it('handles errors without stack traces', () => {
    const err = new Error('Something went wrong')
    delete err.stack

    printError(err, 'Test error')

    const errorList = document.getElementById('error-list')
    expect(errorList.innerHTML).not.toContain('<b>Error Stack</b>:')
  })

  it('handles edge cases and error conditions', () => {
    // Test null/undefined errors
    expect(() => printError(null, 'Test error')).toThrow()
    expect(() => printError(undefined, 'Test error')).toThrow()

    // Test error without message property
    const err = {}
    printError(err, 'Test error')

    const errorList = document.getElementById('error-list')
    expect(errorList.innerHTML).toContain('<b>Error Message</b>: undefined')
  })

  it('prepends new errors to existing error list', () => {
    const errorList = document.getElementById('error-list')
    errorList.innerHTML = '<li class="error">Previous error</li>'

    const err = new Error('New error')
    printError(err, 'New error message')

    expect(errorList.innerHTML).toContain('<b>Error</b>: New error message')
    expect(errorList.innerHTML).toContain('Previous error')
    // New error should be prepended
    expect(errorList.innerHTML.indexOf('<b>Error</b>: New error message')).toBeLessThan(
      errorList.innerHTML.indexOf('Previous error'),
    )
  })
})
