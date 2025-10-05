import { describe, expect, it, beforeEach, afterEach, jest } from '@jest/globals'
import { cleanUpUrl, timeSince, printError } from '../utils.js'

describe('cleanUpUrl', () => {
  it('normalizes protocol, www and trailing slash', () => {
    expect(cleanUpUrl('https://www.Example.com/')).toBe('example.com')
  })

  it('leaves hostname and path intact', () => {
    expect(cleanUpUrl('http://docs.example.com/path/to/page')).toBe('docs.example.com/path/to/page')
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
})
