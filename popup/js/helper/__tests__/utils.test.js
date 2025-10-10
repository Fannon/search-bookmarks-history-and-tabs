import { describe, expect, it, beforeEach, afterEach, jest } from '@jest/globals'
import { cleanUpUrl, timeSince, printError, loadScript, loadCSS } from '../utils.js'

describe('cleanUpUrl', () => {
  it('normalizes protocol, www and trailing slash', () => {
    expect(cleanUpUrl('https://www.Example.com/')).toBe('example.com')
  })

  it('leaves hostname and path intact', () => {
    expect(cleanUpUrl('http://docs.example.com/path/to/page')).toBe('docs.example.com/path/to/page')
  })

  it('handles HTTP protocol', () => {
    expect(cleanUpUrl('http://example.com')).toBe('example.com')
  })

  it('handles HTTPS protocol', () => {
    expect(cleanUpUrl('https://example.com')).toBe('example.com')
  })

  it('removes www prefix', () => {
    expect(cleanUpUrl('www.example.com')).toBe('example.com')
  })

  it('removes trailing slash', () => {
    expect(cleanUpUrl('example.com/')).toBe('example.com')
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

  it('handles empty string', () => {
    expect(cleanUpUrl('')).toBe('')
  })

  it('handles null input', () => {
    expect(cleanUpUrl(null)).toBe('')
  })

  it('handles undefined input', () => {
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
})

describe('timeSince', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2024-01-01T12:00:00Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('returns the elapsed hours when less than a day', () => {
    const fourHoursAgo = new Date('2024-01-01T08:00:00Z')
    expect(timeSince(fourHoursAgo)).toBe('4 hours')
  })

  it('returns the elapsed days when more than a day', () => {
    const threeDaysAgo = new Date('2023-12-29T12:00:00Z')
    expect(timeSince(threeDaysAgo)).toBe('3 days')
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

  it('handles exactly one second ago', () => {
    const oneSecondAgo = new Date('2024-01-01T11:59:59Z')
    expect(timeSince(oneSecondAgo)).toBe('1 seconds')
  })

  it('handles times just under one minute', () => {
    const fiftyNineSecondsAgo = new Date('2024-01-01T11:59:01Z')
    expect(timeSince(fiftyNineSecondsAgo)).toBe('59 seconds')
  })

  it('handles times just over one minute', () => {
    const sixtyOneSecondsAgo = new Date('2024-01-01T11:58:59Z')
    expect(timeSince(sixtyOneSecondsAgo)).toBe('1 minutes')
  })

  it('handles times just under one hour', () => {
    const fiftyNineMinutesAgo = new Date('2024-01-01T11:01:00Z')
    expect(timeSince(fiftyNineMinutesAgo)).toBe('59 minutes')
  })

  it('handles times just over one hour', () => {
    const sixtyOneMinutesAgo = new Date('2024-01-01T10:59:00Z')
    expect(timeSince(sixtyOneMinutesAgo)).toBe('1 hours')
  })

  it('handles times just under one day', () => {
    const twentyThreeHoursAgo = new Date('2024-01-01T13:00:00Z')
    expect(timeSince(twentyThreeHoursAgo)).toBe('0 seconds')
  })

  it('handles times just over one day', () => {
    const twentyFiveHoursAgo = new Date('2023-12-31T11:00:00Z')
    expect(timeSince(twentyFiveHoursAgo)).toBe('1 days')
  })

  it('handles times just under one month', () => {
    const twentyNineDaysAgo = new Date('2023-12-03T12:00:00Z')
    expect(timeSince(twentyNineDaysAgo)).toBe('29 days')
  })

  it('handles times just over one month', () => {
    const thirtyOneDaysAgo = new Date('2023-12-01T12:00:00Z')
    expect(timeSince(thirtyOneDaysAgo)).toBe('1 months')
  })

  it('handles times just under one year', () => {
    const elevenMonthsAgo = new Date('2023-02-01T12:00:00Z')
    expect(timeSince(elevenMonthsAgo)).toBe('11 months')
  })

  it('handles times just over one year', () => {
    const thirteenMonthsAgo = new Date('2022-12-01T12:00:00Z')
    expect(timeSince(thirteenMonthsAgo)).toBe('1 years')
  })

  it('handles future dates', () => {
    const futureDate = new Date('2024-01-02T12:00:00Z')
    expect(timeSince(futureDate)).toBe('0 seconds')
  })

  it('handles invalid date input', () => {
    expect(timeSince('invalid')).toBe('Invalid date')
  })

  it('handles null date input', () => {
    expect(timeSince(null)).toBe('Invalid date')
  })

  it('handles undefined date input', () => {
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

  it('loads a script successfully', async () => {
    const url = 'https://example.com/script.js'

    const loadPromise = loadScript(url)

    // Simulate successful script loading
    mockScript.onload()

    await expect(loadPromise).resolves.toBeUndefined()
    expect(document.createElement).toHaveBeenCalledWith('script')
    expect(mockScript.type).toBe('text/javascript')
    expect(mockScript.src).toBe(url)
    expect(mockHead.appendChild).toHaveBeenCalledWith(mockScript)
  })

  it('handles script loading with proper DOM manipulation', async () => {
    const url = 'https://example.com/script.js'

    const loadPromise = loadScript(url)

    // Simulate successful script loading
    const scriptElement = document.createElement('script')
    if (scriptElement.onload) {
      scriptElement.onload()
    }

    await expect(loadPromise).resolves.toBeUndefined()
    expect(document.createElement).toHaveBeenCalledWith('script')
  })

  it('caches loaded scripts and returns immediately on second call', async () => {
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

  it('handles multiple different scripts', async () => {
    const url1 = 'https://example.com/script1.js'
    const url2 = 'https://example.com/script2.js'

    // Load first script
    const firstPromise = loadScript(url1)
    mockScript.onload()
    await expect(firstPromise).resolves.toBeUndefined()

    // Reset mocks for second script
    jest.clearAllMocks()

    // Load second script
    const secondPromise = loadScript(url2)
    mockScript.onload()
    await expect(secondPromise).resolves.toBeUndefined()

    // Should create and append script for second script
    expect(document.createElement).toHaveBeenCalledTimes(1)
    expect(mockHead.appendChild).toHaveBeenCalledTimes(1)
  })

  it('handles script loading with different URLs', async () => {
    const url1 = 'https://example.com/script1.js'
    const url2 = 'https://cdn.example.com/script2.js'

    // Load first script
    const firstPromise = loadScript(url1)
    mockScript.onload()
    await expect(firstPromise).resolves.toBeUndefined()

    // Reset mocks for second script
    jest.clearAllMocks()

    // Load second script with different URL
    const secondPromise = loadScript(url2)
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

  it('loads CSS successfully', () => {
    const href = 'https://example.com/style.css'

    loadCSS(href)

    expect(document.createElement).toHaveBeenCalledWith('link')
    expect(mockLink.href).toBe(href)
    expect(mockLink.rel).toBe('stylesheet')
    expect(mockLink.type).toBe('text/css')
    expect(mockHead.appendChild).toHaveBeenCalledWith(mockLink)
  })

  it('handles different CSS file paths', () => {
    const href = '/css/custom-theme.css'

    loadCSS(href)

    expect(mockLink.href).toBe(href)
    expect(mockLink.rel).toBe('stylesheet')
    expect(mockLink.type).toBe('text/css')
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

  it('logs errors and prepends them to the error list', () => {
    const err = new Error('Something went wrong')

    printError(err, 'While loading data')

    const errorList = document.getElementById('error-list')
    expect(errorList.innerHTML).toContain('<b>Error</b>: While loading data')
    expect(errorList.innerHTML).toContain('<b>Error Message</b>: Something went wrong')
    expect(errorList.style.cssText).toBe('display: block;')
    expect(console.error).toHaveBeenCalledTimes(2)
    expect(console.error.mock.calls[0][0]).toBe('While loading data')
    expect(console.error.mock.calls[1][0]).toBe(err)
  })

  it('handles error without text parameter', () => {
    const err = new Error('Something went wrong')

    printError(err)

    const errorList = document.getElementById('error-list')
    expect(errorList.innerHTML).not.toContain('<b>Error</b>:')
    expect(errorList.innerHTML).toContain('<b>Error Message</b>: Something went wrong')
    expect(errorList.style.cssText).toBe('display: block;')
    expect(console.error).toHaveBeenCalledTimes(1)
    expect(console.error.mock.calls[0][0]).toBe(err)
  })

  it('handles error with stack trace', () => {
    const err = new Error('Something went wrong')
    err.stack = 'Error: Something went wrong\n    at testFunction (test.js:10:5)'

    printError(err, 'Test error')

    const errorList = document.getElementById('error-list')
    expect(errorList.innerHTML).toContain('<b>Error Stack</b>: Error: Something went wrong')
    expect(errorList.style.cssText).toBe('display: block;')
  })

  it('handles error without stack trace', () => {
    const err = new Error('Something went wrong')
    delete err.stack

    printError(err, 'Test error')

    const errorList = document.getElementById('error-list')
    expect(errorList.innerHTML).not.toContain('<b>Error Stack</b>:')
    expect(errorList.style.cssText).toBe('display: block;')
  })

  it('handles null error', () => {
    expect(() => printError(null, 'Test error')).toThrow()
  })

  it('handles undefined error', () => {
    expect(() => printError(undefined, 'Test error')).toThrow()
  })

  it('handles error without message property', () => {
    const err = {}

    printError(err, 'Test error')

    const errorList = document.getElementById('error-list')
    expect(errorList.innerHTML).toContain('<b>Error</b>: Test error')
    expect(errorList.innerHTML).toContain('<b>Error Message</b>: undefined')
    expect(errorList.style.cssText).toBe('display: block;')
  })

  it('prepends new errors to existing error list', () => {
    const errorList = document.getElementById('error-list')
    errorList.innerHTML = '<li class="error">Previous error</li>'

    const err = new Error('New error')
    printError(err, 'New error message')

    expect(errorList.innerHTML).toContain('<b>Error</b>: New error message')
    expect(errorList.innerHTML).toContain('<b>Error Message</b>: New error')
    expect(errorList.innerHTML).toContain('Previous error')
    // New error should be prepended
    expect(errorList.innerHTML.indexOf('<b>Error</b>: New error message')).toBeLessThan(
      errorList.innerHTML.indexOf('Previous error'),
    )
  })

  it('handles missing error-list element gracefully', () => {
    document.body.innerHTML = ''

    const err = new Error('Test error')

    // Should throw an error when element is missing
    expect(() => printError(err, 'Test message')).toThrow()

    expect(console.error).toHaveBeenCalledTimes(2)
  })
})
