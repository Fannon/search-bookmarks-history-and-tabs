import '../../../../test/setup.js'
import assert from 'node:assert/strict'
import { afterEach, describe, mock, test } from 'node:test'
import { containsText, matches, subset } from '../../../../test/patterns.js'
import {
  createLargeLocalAiTagSelectionWarning,
  getLocalAiTagAvailability,
  suggestBookmarkTags,
} from '../localAiTags.js'

describe('local AI tag suggestions', () => {
  afterEach(() => {
    delete globalThis.LanguageModel
  })
  test('reports unsupported when the browser has no local language model API', async () => {
    delete globalThis.LanguageModel
    assert.strictEqual(await getLocalAiTagAvailability(), 'unsupported')
  })
  test('checks LanguageModel availability with text options', async () => {
    const availability = mock.fn(() => Promise.resolve('available'))
    globalThis.LanguageModel = { availability }
    assert.strictEqual(await getLocalAiTagAvailability(), 'available')
    assert(
      availability.mock.calls.some((call) =>
        matches(call.arguments, [
          {
            expectedInputs: [{ type: 'text', languages: ['en'] }],
            expectedOutputs: [{ type: 'text', languages: ['en'] }],
          },
        ]),
      ),
    )
  })
  test('suggests normalized tags from JSON output', async () => {
    const prompt = mock.fn(() => Promise.resolve('{"tags":["JavaScript", "#Browser AI", "dev/tools"]}'))
    const destroy = mock.fn()
    globalThis.LanguageModel = {
      create: mock.fn(() =>
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
    assert.deepStrictEqual(tags, ['javascript', 'browser-ai', 'devtools'])
    const promptText = prompt.mock.calls[0].arguments[0]
    assert(promptText.includes("Their usage counts show the user's conventions"))
    assert(promptText.includes('chrome (8), ai (5), docs (2), local-ai (1)'))
    assert(promptText.includes('Treat folder names as context, not tags'))
    assert(promptText.includes('open tab title: Prompt API reference - Chrome Developers'))
    assert(promptText.includes('open tab group: Browser APIs'))
    assert(
      prompt.mock.calls.some((call) =>
        matches(call.arguments, [
          containsText('Chrome Prompt API'),
          {
            responseConstraint: subset({ type: 'object' }),
          },
        ]),
      ),
    )
    assert(destroy.mock.callCount() > 0)
  })
  test('allows no suggestion when the model finds no clear tag', async () => {
    const prompt = mock.fn(() => Promise.resolve('{"tags":[]}'))
    globalThis.LanguageModel = {
      create: mock.fn(() =>
        Promise.resolve({
          prompt,
          destroy: mock.fn(),
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
    assert.deepStrictEqual(tags, [])
    assert(
      prompt.mock.calls.some((call) =>
        matches(call.arguments, [
          containsText('Return {"tags":[]}'),
          {
            responseConstraint: subset({
              properties: subset({
                tags: subset({ minItems: 0, maxItems: 5 }),
              }),
            }),
          },
        ]),
      ),
    )
  })
  test('keeps multi-select suggestions only when each bookmark has evidence', async () => {
    const prompt = mock.fn(() => Promise.resolve('{"tags":["github","bitwig","dev","own-repos"]}'))
    globalThis.LanguageModel = {
      create: mock.fn(() =>
        Promise.resolve({
          prompt,
          destroy: mock.fn(),
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
    assert.deepStrictEqual(tags, ['github'])
    const promptText = prompt.mock.calls[0].arguments[0]
    assert(promptText.includes('Only suggest a tag when it clearly applies to EVERY provided bookmark'))
    assert(promptText.includes('A shared folder alone is not enough evidence for a multi-select tag'))
    assert(promptText.includes('do not suggest tags that fit only some bookmarks'))
  })
  test('warns before suggesting tags for large multi-bookmark selections', () => {
    const warning = createLargeLocalAiTagSelectionWarning(21)
    assert(warning.includes('Suggest tags for 21 selected bookmarks?'))
    assert(warning.includes('20 or fewer bookmarks'))
    assert(warning.includes('Only the first 20 bookmarks are included in the prompt'))
    assert(warning.includes('Cancel and narrow the selection'))
  })
  test('uses a broader prompt on second try and keeps inferred common-denominator tags', async () => {
    const prompt = mock.fn(() => Promise.resolve('{"tags":["Browser Marketplace"]}'))
    globalThis.LanguageModel = {
      create: mock.fn(() =>
        Promise.resolve({
          prompt,
          destroy: mock.fn(),
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
    assert.deepStrictEqual(tags, ['browser-marketplace'])
    const promptText = prompt.mock.calls[0].arguments[0]
    assert(promptText.includes('This is a second try after no tags were suggested'))
    assert(promptText.includes('common denominator'))
    assert(promptText.includes('New tags are allowed'))
  })
  test('keeps large-selection retry suggestions strict across every selected bookmark', async () => {
    const prompt = mock.fn(() => Promise.resolve('{"tags":["github"]}'))
    globalThis.LanguageModel = {
      create: mock.fn(() =>
        Promise.resolve({
          prompt,
          destroy: mock.fn(),
        }),
      ),
    }
    const bookmarks = []
    for (let i = 1; i <= 20; i++) {
      bookmarks.push({
        title: `GitHub Repository ${i}`,
        originalUrl: `https://github.com/example/repo-${i}`,
        folderArray: ['Development'],
        tagsArray: [],
      })
    }
    bookmarks.push({
      title: 'Unrelated Documentation',
      originalUrl: 'https://example.com/docs',
      folderArray: ['Development'],
      tagsArray: [],
    })
    const tags = await suggestBookmarkTags(bookmarks, [], undefined, { liberal: true })
    assert.deepStrictEqual(tags, [])
    const promptText = prompt.mock.calls[0].arguments[0]
    assert(promptText.includes('GitHub Repository 20'))
    assert(!promptText.includes('Unrelated Documentation'))
  })
})
