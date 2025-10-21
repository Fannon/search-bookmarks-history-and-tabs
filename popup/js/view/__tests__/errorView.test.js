import { describe, expect, it, beforeEach, afterEach, jest } from '@jest/globals'
import { closeErrors, printError } from '../errorView.js'

describe('closeErrors', () => {
  beforeEach(() => {
    document.body.innerHTML = '<ul id="error-list" style=""></ul>'
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('hides the error list when present', () => {
    closeErrors()
    const element = document.getElementById('error-list')
    expect(element.style.cssText).toBe('display: none;')
  })

  it('does nothing when error list missing', () => {
    document.body.innerHTML = ''
    expect(() => closeErrors()).not.toThrow()
  })
})

describe('printError', () => {
  let consoleErrorSpy

  beforeEach(() => {
    document.body.innerHTML = '<ul id="error-list"><li>existing</li></ul>'
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    document.body.innerHTML = ''
  })

  it('sanitizes content, logs errors, and prepends new entries', () => {
    const err = new Error('<script>alert(1)</script>')
    err.stack = 'Error: stack trace\n at test.js:1'

    printError(err, '<b>bad markup</b>')

    const items = Array.from(document.querySelectorAll('#error-list li'))
    expect(items).toHaveLength(4)

    expect(items[0].querySelector('b').textContent).toBe('Error')
    expect(items[0].innerHTML).toContain('&lt;b&gt;bad markup&lt;/b&gt;')

    expect(items[1].querySelector('b').textContent).toBe('Error Message')
    expect(items[1].innerHTML).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')

    expect(items[2].querySelector('b').textContent).toBe('Error Stack')
    expect(items[3].textContent).toBe('existing')
    expect(document.getElementById('error-list').style.display).toBe('block')
    expect(consoleErrorSpy).toHaveBeenCalled()
  })

  it('handles missing error list gracefully', () => {
    document.body.innerHTML = ''
    expect(() => printError(new Error('boom'))).not.toThrow()
    expect(consoleErrorSpy).toHaveBeenCalled()
  })
})
