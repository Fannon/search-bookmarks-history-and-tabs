import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { closeErrors, printError } from '../errorView.js'

describe('closeErrors', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="error-overlay" class="error-overlay" style="display: block">content</div>
    `
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('hides the error overlay when present', () => {
    closeErrors()
    const overlay = document.getElementById('error-overlay')
    expect(overlay.style.display).toBe('none')
    expect(overlay.innerHTML).toBe('')
  })

  it('does nothing when error elements are missing', () => {
    document.body.innerHTML = ''
    expect(() => closeErrors()).not.toThrow()
  })
})

describe('printError with overlay', () => {
  let consoleErrorSpy

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="error-overlay" class="error-overlay" style="display: none"></div>
    `
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    closeErrors() // Clear error queue between tests
    document.body.innerHTML = ''
  })

  it('renders error in the overlay with dismiss button', () => {
    const err = new Error('Test error message')

    printError(err, 'Something went wrong')

    const overlay = document.getElementById('error-overlay')
    expect(overlay.style.display).toBe('block')
    expect(overlay.innerHTML).toContain('⚠️ An Error Occurred')
    expect(overlay.innerHTML).toContain('Something went wrong')
    expect(overlay.innerHTML).toContain('Test error message')
    expect(overlay.innerHTML).toContain('DISMISS')
    expect(consoleErrorSpy).toHaveBeenCalled()
  })

  it('renders context with strong tag', () => {
    printError(new Error('Test'), 'Context message')

    const overlay = document.getElementById('error-overlay')
    expect(overlay.innerHTML).toContain('<strong>Context message</strong>')
  })

  it('renders stack trace with word wrap', () => {
    const err = new Error('Test')
    err.stack = 'Error: Test\n    at someFunction (file.js:10:5)'

    printError(err)

    const overlay = document.getElementById('error-overlay')
    expect(overlay.innerHTML).toContain('error-stack')
    expect(overlay.innerHTML).toContain('at someFunction')
  })

  it('accumulates multiple errors with count in header', () => {
    printError(new Error('First error'))
    printError(new Error('Second error'))

    const overlay = document.getElementById('error-overlay')
    expect(overlay.innerHTML).toContain('⚠️ 2 Errors Occurred')
    expect(overlay.innerHTML).toContain('First error')
    expect(overlay.innerHTML).toContain('Second error')
  })

  it('sanitizes HTML in error messages', () => {
    const err = new Error('<script>alert(1)</script>')
    printError(err, '<b>bad markup</b>')

    const overlay = document.getElementById('error-overlay')
    expect(overlay.innerHTML).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(overlay.innerHTML).toContain('&lt;b&gt;bad markup&lt;/b&gt;')
  })
})

describe('printError no DOM element', () => {
  let consoleErrorSpy
  let consoleWarnSpy

  beforeEach(() => {
    document.body.innerHTML = ''
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    consoleWarnSpy.mockRestore()
    closeErrors() // Clear error queue between tests
  })

  it('handles missing error elements gracefully', () => {
    expect(() => printError(new Error('boom'))).not.toThrow()
    expect(consoleErrorSpy).toHaveBeenCalled()
    expect(consoleWarnSpy).toHaveBeenCalled()
  })
})
