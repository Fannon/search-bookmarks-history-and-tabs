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
      minItems: 0,
      maxItems: 5,
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
const MAX_SUGGESTED_TAGS = 5

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
 * @param {Object} [options] Prompt options.
 * @param {boolean} [options.liberal=false] Whether to retry with broader inferred tags.
 * @returns {Promise<Array<string>>} Suggested tag names.
 */
export async function suggestBookmarkTags(bookmarks, existingTags = [], onDownloadProgress, options = {}) {
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

    const response = await session.prompt(createTagPrompt(bookmarks, existingTags, options), {
      responseConstraint: TAG_RESPONSE_SCHEMA,
    })

    const tags = parseTagResponse(response)
    return bookmarks.length > 1 && !options.liberal ? filterTagsForEveryBookmark(tags, bookmarks) : tags
  } finally {
    if (typeof session?.destroy === 'function') {
      session.destroy()
    }
  }
}

function createTagPrompt(bookmarks, existingTags, options = {}) {
  const knownTags = formatExistingTagsForPrompt(existingTags)
  const bookmarkLines = bookmarks.slice(0, MAX_BOOKMARKS_IN_PROMPT).map(formatBookmarkForPrompt).join('\n')
  const liberal = Boolean(options.liberal)
  const task = liberal
    ? `Task:
- This is a second try after no tags were suggested.
- Suggest 1 to 5 useful tags more liberally.
- Tags may be inferred from a shared category, marketplace, product family, domain pattern, current tags, or common denominator across the provided bookmarks.
- New tags are allowed when existing tags are too narrow.`
    : bookmarks.length > 1
      ? `Task:
- Suggest tags for a multi-bookmark selection.
- Only suggest a tag when it clearly applies to EVERY provided bookmark.
- Return {"tags":[]} when no tag clearly fits every bookmark.`
      : `Task:
- Suggest tags for one bookmark.
- Return {"tags":[]} when the bookmark has no clear, useful tag suggestion.`
  const targetRules =
    liberal && bookmarks.length > 1
      ? `- For multi-select, every tag must still describe the selection as a whole.
- Prefer tags for the common denominator between the selected bookmarks, such as "browser-extension", "browser-marketplace", "developer-tools", or another reusable topic when supported by the set.
- Avoid tags that fit only one bookmark or one vendor when the selected bookmarks span multiple vendors.`
      : liberal
        ? `- For one bookmark, tags may be inferred from the title, URL, current tags, open tab title, open tab group, or a strong category pattern.`
        : bookmarks.length > 1
          ? `- For multi-select, do not suggest tags that fit only some bookmarks.
- A multi-select tag must be directly supported by each bookmark's title, URL, current tags, open tab title, or open tab group.
- A shared folder alone is not enough evidence for a multi-select tag.
- A domain or tool tag such as "github" is acceptable only when it appears for every bookmark and fits the user's existing tag conventions.`
          : `- For one bookmark, suggest only tags directly supported by the title, URL, current tags, open tab title, open tab group, or a strong existing tag convention.`

  const inventionRule = liberal
    ? '- Invent new concise tags when they describe the common denominator better than existing tags.'
    : '- Invent a new tag only when none of the existing tags describe the bookmark well.'

  const genericRule = liberal
    ? '- Avoid redundant tags, near-duplicates, and tags that only restate one domain or folder.'
    : '- Avoid redundant tags, near-duplicates, generic tags, and tags that only restate the domain or folder.'

  return `
Suggest concise bookmark tags.

${task}

Rules:
- Use 1 to 5 lowercase tags only when useful.
- Prefer existing tags when they fit. Their usage counts show the user's conventions: ${knownTags || 'none'}.
${inventionRule}
- Favor specific, reusable topics, tools, projects, or content types.
- Treat folder names as context, not tags. Do not suggest a tag just because it matches the folder name.
- Use a folder-like tag only when title, URL, existing tags, or high existing tag counts show it is a real user convention.
${genericRule}
- Do not include "#".
- Output JSON only in this shape: {"tags":["example"]} or {"tags":[]}.
${targetRules}

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
    if (result.length >= MAX_SUGGESTED_TAGS) {
      break
    }
  }

  return result
}

function filterTagsForEveryBookmark(tags, bookmarks) {
  const result = []

  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i]
    let appliesToAll = true

    for (let j = 0; j < bookmarks.length; j++) {
      if (!bookmarkHasTagEvidence(bookmarks[j], tag)) {
        appliesToAll = false
        break
      }
    }

    if (appliesToAll) {
      result.push(tag)
    }
  }

  return result
}

function bookmarkHasTagEvidence(bookmark, tag) {
  const evidence = normalizeEvidenceText(
    [
      bookmark.title,
      bookmark.originalUrl || bookmark.url,
      (bookmark.tagsArray || []).join(' '),
      bookmark.openTabTitle,
      bookmark.group,
    ].join(' '),
  )
  const normalizedTag = normalizeEvidenceText(tag)

  return Boolean(normalizedTag && hasEvidenceToken(evidence, normalizedTag))
}

function hasEvidenceToken(evidence, tag) {
  const paddedEvidence = `-${evidence}-`
  return paddedEvidence.includes(`-${tag}-`)
}

function normalizeEvidenceText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
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
