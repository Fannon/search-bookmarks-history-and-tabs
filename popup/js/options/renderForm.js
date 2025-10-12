import { getAtPath } from './formState.js'
import { deepClone, isPlainObject } from '../helper/objectUtils.js'

export function renderOptionsForm({
  container,
  schema,
  uiSchema,
  state,
  errors = new Map(),
  customizedCount,
  sectionState,
  isCustomized,
  handlers,
}) {
  const errorMap = errors instanceof Map ? errors : new Map(errors)

  container.innerHTML = ''

  const root = document.createElement('div')
  root.className = 'options-app'

  const header = createHeader(customizedCount, handlers)
  root.appendChild(header)

  const errorBanner = createErrorBanner(errorMap, handlers)
  if (errorBanner) {
    root.appendChild(errorBanner)
  }

  const sectionsWrapper = document.createElement('div')
  sectionsWrapper.className = 'options-sections'

  const fieldsBySection = groupFieldsBySection(schema)
  for (const sectionId of uiSchema.sectionOrder) {
    const fields = fieldsBySection.get(sectionId)
    if (!fields || fields.length === 0) {
      continue
    }
    const sectionMeta = uiSchema.sections[sectionId] || { title: sectionId }
    const sectionElement = renderSection({
      sectionId,
      sectionMeta,
      fields,
      schema,
      uiSchema,
      state,
      errors: errorMap,
      sectionState,
      isCustomized,
      handlers,
    })
    sectionsWrapper.appendChild(sectionElement)
  }

  root.appendChild(sectionsWrapper)
  container.appendChild(root)
}

function createHeader(customizedCount, handlers) {
  const header = document.createElement('header')
  header.className = 'options-header'

  const summary = document.createElement('div')
  summary.className = 'options-header__summary'
  const title = document.createElement('h1')
  title.textContent = 'Extension Options'
  summary.appendChild(title)

  const customized = document.createElement('div')
  customized.className = 'options-header__customized'
  customized.textContent =
    customizedCount === 1 ? '1 customized field' : `${customizedCount} customized fields`
  summary.appendChild(customized)

  const actions = document.createElement('div')
  actions.className = 'options-header__actions'

  const resetButton = document.createElement('button')
  resetButton.type = 'button'
  resetButton.className = 'options-button options-button--secondary'
  resetButton.textContent = 'Reset all to defaults'
  resetButton.addEventListener('click', () => handlers.onResetAll())
  actions.appendChild(resetButton)

  const downloadButton = document.createElement('button')
  downloadButton.type = 'button'
  downloadButton.className = 'options-button options-button--ghost'
  downloadButton.textContent = 'Download overrides (YAML)'
  downloadButton.addEventListener('click', () => handlers.onDownload())
  actions.appendChild(downloadButton)

  const saveButton = document.createElement('button')
  saveButton.type = 'button'
  saveButton.className = 'options-button options-button--primary'
  saveButton.textContent = 'Save changes'
  saveButton.addEventListener('click', () => handlers.onSubmit())
  actions.appendChild(saveButton)

  header.appendChild(summary)
  header.appendChild(actions)
  return header
}

function createErrorBanner(errors, handlers) {
  if (!errors || errors.size === 0) {
    return null
  }
  const banner = document.createElement('div')
  banner.className = 'options-error-banner'

  const heading = document.createElement('strong')
  heading.textContent = 'Please review the highlighted fields.'
  banner.appendChild(heading)

  const list = document.createElement('ul')
  list.className = 'options-error-banner__list'

  let shown = 0
  for (const [path, messages] of errors.entries()) {
    if (shown >= 3 || messages.length === 0) {
      continue
    }
    const item = document.createElement('li')
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'options-link-button'
    button.textContent = messages[0]
    button.addEventListener('click', () => handlers.onFocus(path))
    item.appendChild(button)
    list.appendChild(item)
    shown += 1
  }

  if (shown > 0) {
    banner.appendChild(list)
  }

  if (errors.size > shown) {
    const more = document.createElement('p')
    more.className = 'options-error-banner__more'
    more.textContent = `+${errors.size - shown} more issue(s)`
    banner.appendChild(more)
  }

  return banner
}

function renderSection({
  sectionId,
  sectionMeta,
  fields,
  schema,
  uiSchema,
  state,
  errors,
  sectionState,
  isCustomized,
  handlers,
}) {
  const section = document.createElement('section')
  section.className = 'options-section'
  section.dataset.section = sectionId

  const header = document.createElement('header')
  header.className = 'options-section__header'

  const toggle = document.createElement('button')
  toggle.type = 'button'
  toggle.className = 'options-section__toggle'
  toggle.textContent = sectionMeta.title
  toggle.addEventListener('click', () => {
    const collapsed = sectionState[sectionId] ?? !!sectionMeta.collapsedByDefault
    handlers.onToggleSection(sectionId, !collapsed)
  })
  header.appendChild(toggle)

  if (sectionMeta.description) {
    const description = document.createElement('p')
    description.className = 'options-section__description'
    description.textContent = sectionMeta.description
    header.appendChild(description)
  }

  section.appendChild(header)

  const collapsed = sectionState[sectionId] ?? !!sectionMeta.collapsedByDefault
  const body = document.createElement('div')
  body.className = 'options-section__body'
  if (collapsed) {
    section.classList.add('options-section--collapsed')
    body.hidden = true
  }

  for (const fieldName of fields) {
    const fieldSchema = schema.properties[fieldName]
    const fieldPath = [fieldName]
    const fieldValue = getAtPath(state.formData, fieldPath)
    const uiField = resolveUiFieldConfig(uiSchema, fieldName, fieldPath)
    const fieldElement = renderField({
      fieldName,
      schema,
      fieldSchema,
      uiField,
      path: fieldPath,
      value: fieldValue,
      errors,
      isCustomized,
      handlers,
      uiSchema,
      state,
      variant: 'root',
    })
    body.appendChild(fieldElement)
  }

  section.appendChild(body)
  return section
}

function renderField({
  fieldName,
  schema,
  fieldSchema,
  uiField,
  path,
  value,
  errors,
  isCustomized,
  handlers,
  uiSchema,
  state,
  variant,
}) {
  const resolvedSchema = resolveSchemaVariant(fieldSchema, value, schema)
  const fieldErrors = collectErrorsForPath(errors, path)

  const container = document.createElement('div')
  container.className = 'options-field'
  if (variant === 'nested') {
    container.classList.add('options-field--nested')
  }
  container.dataset.path = path.join('.')

  if (isCustomized(path)) {
    container.classList.add('options-field--customized')
  }
  if (fieldErrors.length > 0) {
    container.classList.add('options-field--error')
  }

  const header = document.createElement('div')
  header.className = 'options-field__header'

  const label = document.createElement('label')
  label.className = 'options-field__label'
  label.textContent = uiField.label || humanize(fieldName)
  header.appendChild(label)

  const resetButton = document.createElement('button')
  resetButton.type = 'button'
  resetButton.className = 'options-link-button'
  resetButton.textContent = 'Reset'
  resetButton.addEventListener('click', () => handlers.onResetField(path))
  header.appendChild(resetButton)

  const controlWrapper = document.createElement('div')
  controlWrapper.className = 'options-field__control'
  const control = createControl({
    schema,
    fieldSchema: resolvedSchema,
    uiField,
    path,
    value,
    handlers,
    uiSchema,
    state,
    errors,
    isCustomized,
  })
  controlWrapper.appendChild(control)

  container.appendChild(header)
  container.appendChild(controlWrapper)

  if (resolvedSchema.description) {
    const description = document.createElement('p')
    description.className = 'options-field__description'
    description.textContent = resolvedSchema.description
    container.appendChild(description)
  }

  if (fieldErrors.length > 0) {
    const list = document.createElement('ul')
    list.className = 'options-field__errors'
    for (const message of fieldErrors) {
      const item = document.createElement('li')
      item.textContent = message
      list.appendChild(item)
    }
    container.appendChild(list)
  }

  return container
}

function createControl({
  schema,
  fieldSchema,
  uiField,
  path,
  value,
  handlers,
  uiSchema,
  state,
  errors,
  isCustomized,
}) {
  const controlType = resolveControlType(fieldSchema, uiField)
  switch (controlType) {
    case 'switch':
      return createSwitchControl(path, value, handlers)
    case 'segmented':
      return createSegmentedControl(path, fieldSchema, uiField, value, handlers)
    case 'number':
      return createNumberControl(path, fieldSchema, uiField, value, handlers)
    case 'slider':
      return createSliderControl(path, fieldSchema, uiField, value, handlers)
    case 'color':
      return createColorControl(path, value, handlers)
    case 'select':
      return createSelectControl(path, fieldSchema, value, handlers)
    case 'stringList':
      return createStringListControl(path, state, handlers)
    case 'objectList':
      return createObjectListControl({
        schema,
        fieldSchema,
        uiSchema,
        state,
        handlers,
        errors,
        isCustomized,
        path,
      })
    case 'json':
      return createJsonControl(path, value, handlers)
    default:
      return createTextControl(path, value, handlers)
  }
}

function createSwitchControl(path, value, handlers) {
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.checked = !!value
  input.addEventListener('change', () => handlers.onFieldChange(path, input.checked))
  return input
}

function createSegmentedControl(path, schema, uiField, value, handlers) {
  const wrapper = document.createElement('div')
  wrapper.className = 'options-segmented'
  const options = uiField.options || (schema.enum || []).map((option) => ({ value: option, label: humanize(option) }))

  for (const option of options) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'options-segmented__option'
    button.dataset.value = option.value
    button.textContent = option.label
    if (option.value === value) {
      button.classList.add('is-active')
    }
    button.addEventListener('click', () => handlers.onFieldChange(path, option.value))
    wrapper.appendChild(button)
  }

  return wrapper
}

function createNumberControl(path, schema, uiField, value, handlers) {
  const input = document.createElement('input')
  input.type = 'number'
  if (schema.minimum !== undefined) {
    input.min = schema.minimum
  }
  if (schema.maximum !== undefined) {
    input.max = schema.maximum
  }
  if (uiField.step !== undefined) {
    input.step = uiField.step
  }
  input.value = value ?? ''
  input.addEventListener('change', () => {
    const parsed = input.value === '' ? undefined : Number(input.value)
    handlers.onFieldChange(path, parsed)
  })
  return input
}

function createSliderControl(path, schema, uiField, value, handlers) {
  const wrapper = document.createElement('div')
  wrapper.className = 'options-slider'

  const range = document.createElement('input')
  range.type = 'range'
  range.min = schema.minimum ?? 0
  range.max = schema.maximum ?? 1
  range.step = uiField.step ?? 0.01
  range.value = value ?? range.min

  const display = document.createElement('span')
  display.className = 'options-slider__display'
  display.textContent = formatNumber(value)

  range.addEventListener('input', () => {
    const parsed = Number(range.value)
    display.textContent = formatNumber(parsed)
    handlers.onFieldChange(path, parsed)
  })

  wrapper.appendChild(range)
  wrapper.appendChild(display)
  return wrapper
}

function createColorControl(path, value, handlers) {
  const wrapper = document.createElement('div')
  wrapper.className = 'options-color'

  const preview = document.createElement('span')
  preview.className = 'options-color__preview'
  preview.style.backgroundColor = value || '#000000'

  const input = document.createElement('input')
  input.type = 'color'
  input.value = value || '#000000'
  input.addEventListener('input', () => {
    preview.style.backgroundColor = input.value
    handlers.onFieldChange(path, input.value)
  })

  wrapper.appendChild(preview)
  wrapper.appendChild(input)
  return wrapper
}

function createSelectControl(path, schema, value, handlers) {
  const select = document.createElement('select')
  for (const optionValue of schema.enum || []) {
    const option = document.createElement('option')
    option.value = optionValue
    option.textContent = humanize(optionValue)
    if (optionValue === value) {
      option.selected = true
    }
    select.appendChild(option)
  }
  select.addEventListener('change', () => handlers.onFieldChange(path, select.value))
  return select
}

function createTextControl(path, value, handlers) {
  const input = document.createElement('input')
  input.type = 'text'
  input.value = value ?? ''
  input.addEventListener('change', () => handlers.onFieldChange(path, input.value))
  return input
}

function createStringListControl(path, state, handlers) {
  const wrapper = document.createElement('div')
  wrapper.className = 'options-string-list'

  const raw = getAtPath(state.formData, path)
  let items
  if (Array.isArray(raw)) {
    items = raw
  } else if (raw === undefined || raw === null || raw === '') {
    items = []
  } else {
    items = [raw]
  }

  const list = document.createElement('div')
  list.className = 'options-string-list__items'

  items.forEach((itemValue, index) => {
    const row = document.createElement('div')
    row.className = 'options-string-list__item'

    const input = document.createElement('input')
    input.type = 'text'
    input.value = itemValue ?? ''
    input.addEventListener('input', () => {
      handlers.onFieldChange([...path, String(index)], input.value)
    })
    row.appendChild(input)

    const remove = document.createElement('button')
    remove.type = 'button'
    remove.className = 'options-link-button'
    remove.textContent = 'Remove'
    remove.addEventListener('click', () => handlers.onRemoveItem(path, index))
    row.appendChild(remove)

    list.appendChild(row)
  })

  const addButton = document.createElement('button')
  addButton.type = 'button'
  addButton.className = 'options-button options-button--ghost'
  addButton.textContent = 'Add entry'
  addButton.addEventListener('click', () => handlers.onAddItem(path, ''))

  wrapper.appendChild(list)
  wrapper.appendChild(addButton)
  return wrapper
}

function createObjectListControl({ schema, fieldSchema, uiSchema, state, handlers, errors, isCustomized, path }) {
  const wrapper = document.createElement('div')
  wrapper.className = 'options-object-list'

  const items = getAtPath(state.formData, path) || []
  const resolvedItemSchema = resolveItemSchema(schema, fieldSchema)

  const list = document.createElement('div')
  list.className = 'options-object-list__items'

  items.forEach((itemValue, index) => {
    const item = document.createElement('div')
    item.className = 'options-object-list__item'

    const header = document.createElement('div')
    header.className = 'options-object-list__item-header'
    const title = document.createElement('h4')
    const itemLabel = uiSchema.fields[path[0]]?.itemName || 'Item'
    title.textContent = `${itemLabel} ${index + 1}`
    header.appendChild(title)

    const remove = document.createElement('button')
    remove.type = 'button'
    remove.className = 'options-link-button'
    remove.textContent = 'Remove'
    remove.addEventListener('click', () => handlers.onRemoveItem(path, index))
    header.appendChild(remove)

    item.appendChild(header)

    const body = document.createElement('div')
    body.className = 'options-object-list__item-body'

    const properties = resolvedItemSchema.properties || {}
    for (const [propKey, propSchema] of Object.entries(properties)) {
      const nestedPath = [...path, String(index), propKey]
      const nestedValue = itemValue ? itemValue[propKey] : undefined
      const nestedUiField = resolveUiFieldConfig(uiSchema, propKey, nestedPath)
      const fieldElement = renderField({
        fieldName: propKey,
        schema,
        fieldSchema: resolveSchemaVariant(propSchema, nestedValue, schema),
        uiField: nestedUiField,
        path: nestedPath,
        value: nestedValue,
        errors,
        isCustomized,
        handlers,
        uiSchema,
        state,
        variant: 'nested',
      })
      body.appendChild(fieldElement)
    }

    item.appendChild(body)
    list.appendChild(item)
  })

  const addButton = document.createElement('button')
  addButton.type = 'button'
  addButton.className = 'options-button options-button--ghost'
  const itemName = uiSchema.fields[path[0]]?.itemName || 'Item'
  addButton.textContent = `Add ${itemName}`
  addButton.addEventListener('click', () => {
    const defaultItem = defaultObjectForSchema(resolvedItemSchema)
    handlers.onAddItem(path, defaultItem)
  })

  wrapper.appendChild(list)
  wrapper.appendChild(addButton)
  return wrapper
}

function createJsonControl(path, value, handlers) {
  const textarea = document.createElement('textarea')
  textarea.rows = 8
  textarea.className = 'options-json'
  textarea.value = value && Object.keys(value).length ? JSON.stringify(value, null, 2) : ''
  textarea.addEventListener('change', () => {
    if (!textarea.value.trim()) {
      handlers.onFieldChange(path, {})
      return
    }
    try {
      const parsed = JSON.parse(textarea.value)
      handlers.onFieldChange(path, parsed)
    } catch {
      // keep invalid JSON in textarea; validation will surface errors
    }
  })
  return textarea
}

function resolveControlType(schema, uiField) {
  if (uiField.control) {
    return uiField.control
  }
  if (schema.enum) {
    return 'select'
  }
  if (schema.type === 'boolean') {
    return 'switch'
  }
  if (schema.type === 'integer' || schema.type === 'number') {
    return 'number'
  }
  if (schema.type === 'array') {
    const items = schema.items || {}
    if (items.type === 'string') {
      return 'stringList'
    }
    return 'objectList'
  }
  if (schema.type === 'object') {
    return 'json'
  }
  return 'text'
}

function resolveSchemaVariant(schema, value, rootSchema) {
  if (!schema) {
    return schema
  }

  if (schema.$ref) {
    return dereferenceSchema(rootSchema, schema.$ref)
  }

  if (!schema.oneOf) {
    return schema
  }

  if (value === undefined || value === null) {
    return schema.oneOf[0]
  }

  for (const variant of schema.oneOf) {
    if (variant.$ref) {
      const resolved = dereferenceSchema(rootSchema, variant.$ref)
      if (matchesType(resolved, value)) {
        return resolved
      }
    } else if (matchesType(variant, value)) {
      return variant
    }
  }

  return schema.oneOf[0].$ref
    ? dereferenceSchema(rootSchema, schema.oneOf[0].$ref)
    : schema.oneOf[0]
}

function resolveItemSchema(rootSchema, fieldSchema) {
  if (!fieldSchema) {
    return { type: 'object' }
  }
  if (Array.isArray(fieldSchema.items)) {
    return resolveSchemaVariant(fieldSchema.items[0], undefined, rootSchema)
  }
  if (fieldSchema.items && fieldSchema.items.$ref) {
    return dereferenceSchema(rootSchema, fieldSchema.items.$ref)
  }
  return fieldSchema.items || { type: 'object' }
}

function dereferenceSchema(rootSchema, ref) {
  if (!ref || !ref.startsWith('#/')) {
    return {}
  }
  const segments = ref.slice(2).split('/')
  let current = rootSchema
  for (const segment of segments) {
    const key = segment.replace(/~1/g, '/').replace(/~0/g, '~')
    current = current?.[key]
    if (current === undefined) {
      break
    }
  }
  return current || {}
}

function matchesType(schema, value) {
  if (!schema || schema.type === undefined) {
    return true
  }
  if (schema.type === 'array') {
    return Array.isArray(value)
  }
  if (schema.type === 'object') {
    return isPlainObject(value)
  }
  if (schema.type === 'integer') {
    return Number.isInteger(value)
  }
  return typeof value === schema.type
}

function defaultObjectForSchema(schema) {
  const resolved = schema.$ref ? {} : schema
  if (!resolved.properties) {
    return {}
  }
  const result = {}
  for (const [key, propertySchema] of Object.entries(resolved.properties)) {
    if (propertySchema.default !== undefined) {
      result[key] = deepClone(propertySchema.default)
    } else if (propertySchema.type === 'array') {
      result[key] = []
    } else if (propertySchema.type === 'object') {
      result[key] = {}
    } else {
      result[key] = ''
    }
  }
  return result
}

function resolveUiFieldConfig(uiSchema, fieldName, path) {
  const fullPath = path.join('.')
  return (
    uiSchema.fields?.[fullPath] ||
    uiSchema.fields?.[`${path[0]}[].${fieldName}`] ||
    uiSchema.fields?.[fieldName] ||
    {}
  )
}

function groupFieldsBySection(schema) {
  const grouped = new Map()
  for (const [fieldName, fieldSchema] of Object.entries(schema.properties)) {
    const section = fieldSchema['ui:section'] || 'general'
    if (!grouped.has(section)) {
      grouped.set(section, [])
    }
    grouped.get(section).push(fieldName)
  }
  for (const fields of grouped.values()) {
    fields.sort((left, right) => left.localeCompare(right))
  }
  return grouped
}

function collectErrorsForPath(errors, path) {
  const key = path.join('.')
  return errors.get(key) || []
}

function humanize(value) {
  return value
    .toString()
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^./, (match) => match.toUpperCase())
    .trim()
}

function formatNumber(value) {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return ''
  }
  if (Number.isInteger(value)) {
    return value.toString()
  }
  return value.toFixed(2)
}
