/**
 * @file Optional local AI tag suggestions for bookmarks.
 */

const LANGUAGE_MODEL_OPTIONS = {
  expectedInputs: [{ type: 'text', languages: ['en'] }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }],
}

const TAG_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    tags: {
      type: 'array',
      minItems: 1,
      maxItems: 8,
      items: {
        type: 'string',
        minLength: 1,
        maxLength: 32,
      },
    },
  },
  required: ['tags'],
}

const MAX_BOOKMARKS_IN_PROMPT = 16

/**
 * Check the browser-managed local LLM availability.
 *
 * @returns {Promise<string>} Prompt API availability state.
 */
export async function getLocalAiTagAvailability() {
  const languageModel = globalThis.LanguageModel
  if (!languageModel?.availability) {
    return 'unsupported'
  }

  try {
    return await languageModel.availability(LANGUAGE_MODEL_OPTIONS)
  } catch (error) {
    console.warn('Local AI tag suggestions are unavailable.', error)
    return 'unavailable'
  }
}

/**
 * Suggest tags for one or more bookmarks using the browser's local LLM.
 *
 * @param {Array<Object>} bookmarks Bookmark entries.
 * @param {Array<string>} existingTags Known tags from the current bookmark set.
 * @param {Function} [onDownloadProgress] Progress callback for model download.
 * @returns {Promise<Array<string>>} Suggested tag names.
 */
export async function suggestBookmarkTags(bookmarks, existingTags = [], onDownloadProgress) {
  const languageModel = globalThis.LanguageModel
  if (!languageModel?.create) {
    throw new Error('Local AI is not available in this browser.')
  }

  let session
  try {
    session = await languageModel.create({
      ...LANGUAGE_MODEL_OPTIONS,
      monitor(monitorTarget) {
        monitorTarget.addEventListener('downloadprogress', (event) => {
          if (onDownloadProgress) {
            onDownloadProgress(event.loaded || 0)
          }
        })
      },
    })

    const response = await session.prompt(createTagPrompt(bookmarks, existingTags), {
      responseConstraint: TAG_RESPONSE_SCHEMA,
    })

    return parseTagResponse(response)
  } finally {
    if (typeof session?.destroy === 'function') {
      session.destroy()
    }
  }
}

function createTagPrompt(bookmarks, existingTags) {
  const knownTags = formatExistingTagsForPrompt(existingTags)
  const bookmarkLines = bookmarks.slice(0, MAX_BOOKMARKS_IN_PROMPT).map(formatBookmarkForPrompt).join('\n')
  const multiHint = bookmarks.length > 1 ? '\n- Only suggest tags that apply to ALL of the provided bookmarks.' : ''

  return `
Suggest concise bookmark tags.

Rules:
- Use 1 to 5 lowercase tags. Return fewer tags when the signal is weak.
- Prefer existing tags when they fit. Their usage counts show the user's conventions: ${knownTags || 'none'}.
- Invent a new tag only when none of the existing tags describe the bookmark well.
- Favor specific, reusable topics, tools, projects, or content types.
- Treat folder names as context, not tags. Do not suggest a tag just because it matches the folder name.
- Use a folder-like tag only when title, URL, existing tags, or high existing tag counts show it is a real user convention.
- Avoid redundant tags, near-duplicates, generic tags, and tags that only restate the domain or folder.
- Do not include "#".
- Output JSON only in this shape: {"tags":["example"]}.${multiHint}

Bookmarks:
${bookmarkLines}
  `.trim()
}

function formatExistingTagsForPrompt(tags) {
  return normalizeExistingTags(tags)
    .map((tag) => `${tag.name} (${tag.count})`)
    .join(', ')
}

function formatBookmarkForPrompt(bookmark, index) {
  const title = limitPromptText(bookmark.title || '')
  const url = limitPromptText(bookmark.originalUrl || bookmark.url || '')
  const folder = limitPromptText((bookmark.folderArray || []).join(' / '))
  const tags = limitPromptText((bookmark.tagsArray || []).join(', '))
  const openTabTitle = limitPromptText(bookmark.openTabTitle || '')
  const openTabGroup = limitPromptText(bookmark.group || '')

  return `${index + 1}. title: ${title}\n   url: ${url}\n   folder: ${folder || 'none'}\n   current tags: ${tags || 'none'}\n   open tab title: ${openTabTitle || 'not open'}\n   open tab group: ${openTabGroup || 'none'}`
}

function parseTagResponse(response) {
  let parsed
  try {
    parsed = JSON.parse(response)
  } catch {
    parsed = { tags: String(response || '').split(/[#,;\n]/) }
  }

  return normalizeTags(parsed.tags || [])
}

function normalizeTags(tags) {
  const seen = new Set()
  const result = []

  for (let i = 0; i < tags.length; i++) {
    const tag = String(tags[i] || '')
      .replaceAll('#', '')
      .replace(/[^a-z0-9 _.-]/gi, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
      .toLowerCase()

    if (!tag || seen.has(tag)) {
      continue
    }

    seen.add(tag)
    result.push(tag)
    if (result.length >= 8) {
      break
    }
  }

  return result
}

function normalizeExistingTags(tags) {
  const seen = new Set()
  const result = []

  for (let i = 0; i < tags.length; i++) {
    const tag = normalizeExistingTagEntry(tags[i])
    const key = tag.name.toLowerCase()

    if (!tag.name || seen.has(key)) {
      continue
    }

    seen.add(key)
    result.push(tag)
  }

  return result.sort((a, b) => {
    if (a.count !== b.count) {
      return b.count - a.count
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
}

function normalizeExistingTagEntry(tag) {
  if (tag && typeof tag === 'object') {
    return {
      name: String(tag.name || '').trim(),
      count: normalizeTagCount(tag.count),
    }
  }

  return {
    name: String(tag || '').trim(),
    count: 1,
  }
}

function normalizeTagCount(count) {
  const value = Number(count)
  if (!Number.isFinite(value) || value < 1) {
    return 1
  }
  return Math.round(value)
}

function limitPromptText(value) {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= 180) {
    return text
  }
  return `${text.slice(0, 177)}...`
}
