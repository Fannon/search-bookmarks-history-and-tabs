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
      [
        { name: 'docs', count: 2 },
        { name: 'chrome', count: 8 },
        { name: 'ai', count: 5 },
        { name: 'local-ai', count: 1 },
      ],
    )

    expect(tags).toEqual(['javascript', 'browser-ai', 'devtools'])
    const promptText = prompt.mock.calls[0][0]
    expect(promptText).toContain("Their usage counts show the user's conventions")
    expect(promptText).toContain('chrome (8), ai (5), docs (2), local-ai (1)')
    expect(promptText).toContain('Treat folder names as context, not tags')
    expect(promptText).toContain('open tab title: Prompt API reference - Chrome Developers')
    expect(promptText).toContain('open tab group: Browser APIs')
    expect(prompt).toHaveBeenCalledWith(expect.stringContaining('Chrome Prompt API'), {
      responseConstraint: expect.objectContaining({ type: 'object' }),
    })
    expect(destroy).toHaveBeenCalled()
  })

  test('allows no suggestion when the model finds no clear tag', async () => {
    const prompt = jest.fn(() => Promise.resolve('{"tags":[]}'))
    globalThis.LanguageModel = {
      create: jest.fn(() =>
        Promise.resolve({
          prompt,
          destroy: jest.fn(),
        }),
      ),
    }

    const tags = await suggestBookmarkTags([
      {
        title: 'Untitled',
        originalUrl: 'https://example.com/random',
        folderArray: ['Later'],
        tagsArray: [],
      },
    ])

    expect(tags).toEqual([])
    expect(prompt).toHaveBeenCalledWith(expect.stringContaining('Return {"tags":[]}'), {
      responseConstraint: expect.objectContaining({
        properties: expect.objectContaining({
          tags: expect.objectContaining({ minItems: 0, maxItems: 5 }),
        }),
      }),
    })
  })

  test('keeps multi-select suggestions only when each bookmark has evidence', async () => {
    const prompt = jest.fn(() => Promise.resolve('{"tags":["github","bitwig","dev","own-repos"]}'))
    globalThis.LanguageModel = {
      create: jest.fn(() =>
        Promise.resolve({
          prompt,
          destroy: jest.fn(),
        }),
      ),
    }

    const tags = await suggestBookmarkTags(
      [
        {
          title: 'Search Bookmarks, History and Tabs',
          originalUrl: 'https://github.com/Fannon/search-bookmarks-history-and-tabs',
          folderArray: ['Dev', 'Own Repos'],
          tagsArray: ['github', 'bookmark', 'search'],
        },
        {
          title: 'Fannon/config',
          originalUrl: 'https://github.com/Fannon/config',
          folderArray: ['Dev', 'Own Repos'],
          tagsArray: [],
        },
        {
          title: 'Fannon/Launchpad-Pro-Mk3-Bitwig-Controller',
          originalUrl: 'https://github.com/Fannon/Launchpad-Pro-Mk3-Bitwig-Controller',
          folderArray: ['Dev', 'Own Repos'],
          tagsArray: ['bitwig', 'github'],
        },
      ],
      [
        { name: 'github', count: 12 },
        { name: 'dev', count: 10 },
        { name: 'bitwig', count: 2 },
      ],
    )

    expect(tags).toEqual(['github'])
    const promptText = prompt.mock.calls[0][0]
    expect(promptText).toContain('Only suggest a tag when it clearly applies to EVERY provided bookmark')
    expect(promptText).toContain('A shared folder alone is not enough evidence for a multi-select tag')
    expect(promptText).toContain('do not suggest tags that fit only some bookmarks')
  })

  test('uses a broader prompt on second try and keeps inferred common-denominator tags', async () => {
    const prompt = jest.fn(() => Promise.resolve('{"tags":["Browser Marketplace"]}'))
    globalThis.LanguageModel = {
      create: jest.fn(() =>
        Promise.resolve({
          prompt,
          destroy: jest.fn(),
        }),
      ),
    }

    const tags = await suggestBookmarkTags(
      [
        {
          title: 'Chrome Web Store',
          originalUrl: 'https://chromewebstore.google.com/detail/search-bookmarks',
          folderArray: ['Browser Marketplaces'],
          tagsArray: [],
        },
        {
          title: 'Firefox Add-ons',
          originalUrl: 'https://addons.mozilla.org/firefox/addon/search-bookmarks',
          folderArray: ['Browser Marketplaces'],
          tagsArray: [],
        },
      ],
      [],
      undefined,
      { liberal: true },
    )

    expect(tags).toEqual(['browser-marketplace'])
    const promptText = prompt.mock.calls[0][0]
    expect(promptText).toContain('This is a second try after no tags were suggested')
    expect(promptText).toContain('common denominator')
    expect(promptText).toContain('New tags are allowed')
  })
})
