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
  const knownTags = normalizeExistingTags(existingTags).join(', ')
  const bookmarkLines = bookmarks.slice(0, MAX_BOOKMARKS_IN_PROMPT).map(formatBookmarkForPrompt).join('\n')

  return `
Suggest concise bookmark tags.

Rules:
- Use 3 to 8 lowercase tags.
- Prefer tags from this full existing tag vocabulary when they fit: ${knownTags || 'none'}.
- Invent a new tag only when none of the existing tags describe the bookmark well.
- Tags should describe topics, tools, projects, or content type.
- Do not include "#".
- Output JSON only in this shape: {"tags":["example"]}.

Bookmarks:
${bookmarkLines}
  `.trim()
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
    const tag = String(tags[i] || '').trim()
    const key = tag.toLowerCase()

    if (!tag || seen.has(key)) {
      continue
    }

    seen.add(key)
    result.push(tag)
  }

  return result
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
