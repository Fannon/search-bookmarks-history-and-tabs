import { afterEach, describe, expect, jest, test } from '@jest/globals'
import { getLocalAiTagAvailability, suggestBookmarkTags } from '../localAiTags.js'

describe('local AI tag suggestions', () => {
  afterEach(() => {
    delete globalThis.LanguageModel
  })

  test('reports unsupported when the browser has no local language model API', async () => {
    delete globalThis.LanguageModel

    await expect(getLocalAiTagAvailability()).resolves.toBe('unsupported')
  })

  test('checks LanguageModel availability with text options', async () => {
    const availability = jest.fn(() => Promise.resolve('available'))
    globalThis.LanguageModel = { availability }

    await expect(getLocalAiTagAvailability()).resolves.toBe('available')
    expect(availability).toHaveBeenCalledWith({
      expectedInputs: [{ type: 'text', languages: ['en'] }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }],
    })
  })

  test('suggests normalized tags from JSON output', async () => {
    const prompt = jest.fn(() => Promise.resolve('{"tags":["JavaScript", "#Browser AI", "dev/tools"]}'))
    const destroy = jest.fn()
    globalThis.LanguageModel = {
      create: jest.fn(() =>
        Promise.resolve({
          prompt,
          destroy,
        }),
      ),
    }

    const tags = await suggestBookmarkTags(
      [
        {
          title: 'Chrome Prompt API',
          originalUrl: 'https://developer.chrome.com/docs/ai/prompt-api',
          folderArray: ['Docs'],
          tagsArray: ['chrome'],
          openTabTitle: 'Prompt API reference - Chrome Developers',
          group: 'Browser APIs',
        },
      ],
      ['chrome', 'ai', 'docs', 'local-ai'],
    )

    expect(tags).toEqual(['javascript', 'browser-ai', 'devtools'])
    const promptText = prompt.mock.calls[0][0]
    expect(promptText).toContain('Prefer tags from this full existing tag vocabulary')
    expect(promptText).toContain('chrome, ai, docs, local-ai')
    expect(promptText).toContain('open tab title: Prompt API reference - Chrome Developers')
    expect(promptText).toContain('open tab group: Browser APIs')
    expect(prompt).toHaveBeenCalledWith(expect.stringContaining('Chrome Prompt API'), {
      responseConstraint: expect.objectContaining({ type: 'object' }),
    })
    expect(destroy).toHaveBeenCalled()
  })
})
