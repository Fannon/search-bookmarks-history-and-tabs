import {
  defaultOptions,
  getEffectiveOptions,
  setUserOptions,
} from '../model/options.js'
import { optionSections } from './optionsFormSchema.js'

let fieldControllers = new Map()

export async function initOptions() {
  const optionsRoot = document.getElementById('options')
  if (!optionsRoot) {
    throw new Error('Options container was not found')
  }

  const [effectiveOptions] = await Promise.all([getEffectiveOptions()])
  renderForm(effectiveOptions)

  document.getElementById('edit-options-reset').addEventListener('click', (event) => {
    event.preventDefault()
    resetOptions()
  })

  document.getElementById('edit-options-save').addEventListener('click', (event) => {
    event.preventDefault()
    saveOptions().catch((error) => {
      showStatus(`Could not save options: ${error.message}`, true)
      console.error(error)
    })
  })
}

function renderForm(initialValues) {
  fieldControllers = new Map()
  const form = document.getElementById('options-form')
  form.innerHTML = ''

  optionSections.forEach((section) => {
    const sectionEl = document.createElement('section')
    sectionEl.className = 'option-section'
    sectionEl.id = `section-${section.id}`

    const header = document.createElement('div')
    header.className = 'section-header'

    const title = document.createElement('h2')
    title.textContent = section.title
    header.appendChild(title)

    if (section.description) {
      const description = document.createElement('p')
      description.className = 'section-description'
      description.textContent = section.description
      header.appendChild(description)
    }

    sectionEl.appendChild(header)

    Object.entries(section.properties).forEach(([key, schema]) => {
      const value = initialValues[key]
      const controller = createFieldController(key, schema, value)
      fieldControllers.set(key, controller)
      sectionEl.appendChild(controller.element)
    })

    form.appendChild(sectionEl)
  })
}

function createFieldController(key, schema, initialValue) {
  const container = document.createElement('div')
  container.className = 'option-field'

  const inputId = `opt-${key}`

  const label = document.createElement('label')
  label.setAttribute('for', inputId)
  label.textContent = schema.title
  container.appendChild(label)

  if (schema.description) {
    const description = document.createElement('p')
    description.className = 'field-description'
    description.textContent = schema.description
    container.appendChild(description)
  }

  const defaultDisplay = document.createElement('div')
  defaultDisplay.className = 'field-default'
  const defaultValue = defaultOptions[key]
  defaultDisplay.textContent = `Default: ${formatDefaultValue(defaultValue)}`
  container.appendChild(defaultDisplay)

  let controller

  if (schema.type === 'boolean') {
    controller = createBooleanField(inputId, initialValue)
  } else if (schema.type === 'string' && schema.enum) {
    controller = createSelectField(inputId, initialValue, schema.enum)
  } else if (schema.type === 'string' && schema.format === 'color') {
    controller = createColorField(inputId, initialValue)
  } else if (schema.type === 'string' && schema.ui?.widget === 'multiline') {
    controller = createStringListField(inputId, initialValue)
  } else if (schema.type === 'string' && schema.ui?.widget === 'json') {
    controller = createJsonField(inputId, initialValue)
  } else if (schema.type === 'string') {
    controller = createTextField(inputId, initialValue)
  } else if (schema.type === 'integer' || schema.type === 'number') {
    controller = createNumberField(inputId, initialValue, schema)
  } else if (schema.type === 'array' && schema.items?.type === 'string') {
    controller = createStringArrayField(inputId, initialValue)
  } else if (schema.type === 'array' && schema.items?.type === 'object') {
    controller = createObjectArrayField(key, schema, initialValue)
  } else if (schema.type === 'object') {
    controller = createJsonField(inputId, initialValue)
  } else {
    throw new Error(`Unsupported schema type for ${key}`)
  }

  container.appendChild(controller.element)

  const errorEl = document.createElement('div')
  errorEl.className = 'field-error'
  container.appendChild(errorEl)

  return {
    element: container,
    getValue: controller.getValue,
    setValue: controller.setValue,
    validate: () => {
      const { valid, message } = controller.validate(schema)
      if (!valid) {
        errorEl.textContent = message
        errorEl.style.display = 'block'
      } else {
        errorEl.textContent = ''
        errorEl.style.display = 'none'
      }
      return valid
    },
    clearError: () => {
      errorEl.textContent = ''
      errorEl.style.display = 'none'
    },
  }
}

function createBooleanField(id, initialValue) {
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.id = id
  input.checked = Boolean(initialValue)

  return {
    element: wrapInput(input),
    getValue: () => input.checked,
    setValue: (value) => {
      input.checked = Boolean(value)
    },
    validate: () => ({ valid: true }),
  }
}

function createSelectField(id, initialValue, enumValues) {
  const select = document.createElement('select')
  select.id = id
  enumValues.forEach((value) => {
    const option = document.createElement('option')
    option.value = value
    option.textContent = value
    select.appendChild(option)
  })
  select.value = initialValue

  return {
    element: wrapInput(select),
    getValue: () => select.value,
    setValue: (value) => {
      select.value = value
    },
    validate: (schema) => ({
      valid: schema.enum.includes(select.value),
      message: 'Select one of the available options.',
    }),
  }
}

function createColorField(id, initialValue) {
  const input = document.createElement('input')
  input.type = 'color'
  input.id = id
  input.value = typeof initialValue === 'string' ? initialValue : '#000000'

  return {
    element: wrapInput(input),
    getValue: () => input.value,
    setValue: (value) => {
      input.value = typeof value === 'string' ? value : '#000000'
    },
    validate: () => ({ valid: /^#([0-9a-fA-F]{3}){1,2}$/.test(input.value), message: 'Enter a valid hex colour.' }),
  }
}

function createTextField(id, initialValue) {
  const input = document.createElement('input')
  input.type = 'text'
  input.id = id
  input.value = initialValue ?? ''

  return {
    element: wrapInput(input),
    getValue: () => input.value,
    setValue: (value) => {
      input.value = value ?? ''
    },
    validate: () => ({ valid: true }),
  }
}

function createStringListField(id, initialValue) {
  const textarea = document.createElement('textarea')
  textarea.id = id
  textarea.rows = 3
  textarea.value = Array.isArray(initialValue) ? initialValue.join('\n') : ''

  return {
    element: wrapInput(textarea),
    getValue: () =>
      textarea.value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    setValue: (value) => {
      textarea.value = Array.isArray(value) ? value.join('\n') : ''
    },
    validate: () => ({ valid: true }),
  }
}

function createStringArrayField(id, initialValue) {
  return createStringListField(id, initialValue)
}

function createJsonField(id, initialValue) {
  const textarea = document.createElement('textarea')
  textarea.id = id
  textarea.rows = 6
  textarea.value = initialValue && Object.keys(initialValue).length > 0 ? JSON.stringify(initialValue, null, 2) : ''

  return {
    element: wrapInput(textarea),
    getValue: () => {
      const value = textarea.value.trim()
      if (!value) {
        return {}
      }
      return JSON.parse(value)
    },
    setValue: (value) => {
      textarea.value = value && Object.keys(value).length > 0 ? JSON.stringify(value, null, 2) : ''
    },
    validate: () => {
      try {
        const value = textarea.value.trim()
        if (!value) {
          return { valid: true }
        }
        JSON.parse(value)
        return { valid: true }
      } catch {
        return { valid: false, message: 'Enter valid JSON.' }
      }
    },
  }
}

function createNumberField(id, initialValue, schema) {
  const input = document.createElement('input')
  input.type = 'number'
  input.id = id
  if (schema.type === 'integer') {
    input.step = '1'
  } else if (schema.multipleOf) {
    input.step = schema.multipleOf.toString()
  } else {
    input.step = '0.1'
  }
  if (typeof schema.minimum === 'number') {
    input.min = schema.minimum
  }
  if (typeof schema.maximum === 'number') {
    input.max = schema.maximum
  }
  input.value = typeof initialValue === 'number' ? String(initialValue) : ''

  return {
    element: wrapInput(input),
    getValue: () => {
      const value = schema.type === 'integer' ? parseInt(input.value, 10) : parseFloat(input.value)
      return Number.isNaN(value) ? 0 : value
    },
    setValue: (value) => {
      input.value = typeof value === 'number' ? String(value) : ''
    },
    validate: () => {
      const value = schema.type === 'integer' ? parseInt(input.value, 10) : parseFloat(input.value)
      if (Number.isNaN(value)) {
        return { valid: false, message: 'Enter a valid number.' }
      }
      if (typeof schema.minimum === 'number' && value < schema.minimum) {
        return { valid: false, message: `Value must be at least ${schema.minimum}.` }
      }
      if (typeof schema.maximum === 'number' && value > schema.maximum) {
        return { valid: false, message: `Value must be at most ${schema.maximum}.` }
      }
      return { valid: true }
    },
  }
}

function createObjectArrayField(key, schema, initialValue) {
  const container = document.createElement('div')
  container.className = 'object-array'
  const itemsContainer = document.createElement('div')
  itemsContainer.className = 'object-array-items'
  container.appendChild(itemsContainer)

  const addButton = document.createElement('button')
  addButton.type = 'button'
  addButton.className = 'button secondary'
  addButton.textContent = schema.ui?.addButtonLabel ?? 'Add item'
  container.appendChild(addButton)

  const itemControllers = []

  const addItem = (value = {}) => {
    const itemWrapper = document.createElement('div')
    itemWrapper.className = 'object-array-item'

    const itemHeader = document.createElement('div')
    itemHeader.className = 'object-array-item-header'
    const title = document.createElement('h3')
    title.textContent = schema.items.title ?? 'Item'
    itemHeader.appendChild(title)

    const removeButton = document.createElement('button')
    removeButton.type = 'button'
    removeButton.className = 'button link remove-item'
    removeButton.textContent = 'Remove'
    itemHeader.appendChild(removeButton)

    itemWrapper.appendChild(itemHeader)

    const fields = []
    Object.entries(schema.items.properties).forEach(([propertyKey, propertySchema]) => {
      const nestedKey = `${key}.${propertyKey}-${Math.random().toString(36).slice(2)}`
      const field = createNestedField(nestedKey, propertySchema, value[propertyKey])
      fields.push({ key: propertyKey, field })
      itemWrapper.appendChild(field.element)
    })

    const itemError = document.createElement('div')
    itemError.className = 'field-error'
    itemWrapper.appendChild(itemError)

    removeButton.addEventListener('click', () => {
      const index = itemControllers.findIndex((controller) => controller.field === itemWrapper)
      if (index >= 0) {
        itemControllers.splice(index, 1)
      }
      itemWrapper.remove()
    })

    itemsContainer.appendChild(itemWrapper)

    const controller = {
      field: itemWrapper,
      getValue: () => {
        const result = {}
        fields.forEach(({ key: propKey, field: nestedField }) => {
          result[propKey] = nestedField.getValue()
        })
        return result
      },
      setValue: (newValue) => {
        fields.forEach(({ key: propKey, field: nestedField }) => {
          nestedField.setValue(newValue[propKey])
        })
      },
      validate: () => {
        const messages = []
        fields.forEach(({ field: nestedField, key: propKey }) => {
          const { valid, message } = nestedField.validate()
          if (!valid) {
            messages.push(`${schema.items.properties[propKey].title}: ${message}`)
          }
        })
        if (schema.items.required) {
          schema.items.required.forEach((requiredKey) => {
            const fieldValue = fields.find(({ key: propKey }) => propKey === requiredKey)?.field.getValue()
            if (fieldValue === undefined || fieldValue === '' || (Array.isArray(fieldValue) && fieldValue.length === 0)) {
              messages.push(`${schema.items.properties[requiredKey].title} is required.`)
            }
          })
        }
        if (messages.length > 0) {
          itemError.textContent = messages.join(' ')
          itemError.style.display = 'block'
          return false
        }
        itemError.textContent = ''
        itemError.style.display = 'none'
        return true
      },
    }

    itemControllers.push(controller)
  }

  addButton.addEventListener('click', () => addItem())

  if (Array.isArray(initialValue) && initialValue.length > 0) {
    initialValue.forEach((value) => addItem(value))
  }

  return {
    element: container,
    getValue: () => itemControllers.map((controller) => controller.getValue()),
    setValue: (values) => {
      itemControllers.splice(0, itemControllers.length)
      itemsContainer.innerHTML = ''
      if (Array.isArray(values) && values.length > 0) {
        values.forEach((value) => addItem(value))
      }
    },
    validate: () => {
      if (!itemControllers.length) {
        return { valid: true }
      }
      const validity = itemControllers.map((controller) => controller.validate())
      return validity.every(Boolean)
        ? { valid: true }
        : { valid: false, message: 'Please fix validation issues above.' }
    },
  }
}

function createNestedField(id, schema, initialValue) {
  const container = document.createElement('div')
  container.className = 'option-field nested'

  const label = document.createElement('label')
  label.setAttribute('for', id)
  label.textContent = schema.title
  container.appendChild(label)

  if (schema.description) {
    const description = document.createElement('p')
    description.className = 'field-description'
    description.textContent = schema.description
    container.appendChild(description)
  }

  let controller
  if (schema.type === 'string' && schema.ui?.widget === 'tags') {
    controller = createTagsField(id, initialValue)
  } else if (schema.type === 'string') {
    controller = createTextField(id, initialValue)
  } else if (schema.type === 'array' && schema.items?.type === 'string') {
    controller = createTagsField(id, initialValue)
  } else {
    controller = createTextField(id, initialValue)
  }

  container.appendChild(controller.element)

  const errorEl = document.createElement('div')
  errorEl.className = 'field-error'
  container.appendChild(errorEl)

  return {
    element: container,
    getValue: controller.getValue,
    setValue: controller.setValue,
    validate: () => {
      const { valid, message } = controller.validate(schema)
      if (!valid) {
        errorEl.textContent = message
        errorEl.style.display = 'block'
      } else {
        errorEl.textContent = ''
        errorEl.style.display = 'none'
      }
      return { valid, message }
    },
  }
}

function createTagsField(id, initialValue) {
  const input = document.createElement('input')
  input.type = 'text'
  input.id = id
  input.placeholder = 'Comma separated values'
  input.value = Array.isArray(initialValue) ? initialValue.join(', ') : initialValue ?? ''

  return {
    element: wrapInput(input),
    getValue: () =>
      input.value
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    setValue: (value) => {
      input.value = Array.isArray(value) ? value.join(', ') : value ?? ''
    },
    validate: () => ({ valid: true }),
  }
}

function wrapInput(input) {
  const wrapper = document.createElement('div')
  wrapper.className = 'input-wrapper'
  wrapper.appendChild(input)
  return wrapper
}

async function saveOptions() {
  clearStatus()

  const values = {}
  let isValid = true
  fieldControllers.forEach((controller, key) => {
    controller.clearError()
    const valid = controller.validate()
    if (!valid) {
      isValid = false
      return
    }
    values[key] = controller.getValue()
  })

  if (!isValid) {
    showStatus('Please fix the highlighted fields before saving.', true)
    throw new Error('Validation failed')
  }

  const overrides = diffOptions(defaultOptions, values)
  await setUserOptions(overrides)
  showStatus('Options saved successfully.')
}

function resetOptions() {
  fieldControllers.forEach((controller, key) => {
    const defaultValue = defaultOptions[key]
    controller.setValue(defaultValue)
    controller.clearError()
  })
  clearStatus()
  showStatus('Options reset to defaults. Remember to save to apply the change.')
}

function diffOptions(defaults, current) {
  if (deepEqual(defaults, current)) {
    return {}
  }

  const diff = {}
  Object.keys(current).forEach((key) => {
    const value = current[key]
    const defaultValue = defaults[key]
    if (deepEqual(value, defaultValue)) {
      return
    }
    if (isPlainObject(value) && isPlainObject(defaultValue)) {
      const nestedDiff = diffOptions(defaultValue, value)
      if (Object.keys(nestedDiff).length > 0) {
        diff[key] = nestedDiff
      }
    } else {
      diff[key] = value
    }
  })
  return diff
}

function deepEqual(a, b) {
  if (a === b) {
    return true
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false
    }
    return a.every((value, index) => deepEqual(value, b[index]))
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const aKeys = Object.keys(a)
    const bKeys = Object.keys(b)
    if (aKeys.length !== bKeys.length) {
      return false
    }
    return aKeys.every((key) => deepEqual(a[key], b[key]))
  }
  return false
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]'
}

function formatDefaultValue(value) {
  if (Array.isArray(value)) {
    if (!value.length) {
      return 'none'
    }
    if (value.every((item) => typeof item === 'string')) {
      return value.join(', ')
    }
    return `${value.length} item(s)`
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value)
    if (!keys.length) {
      return '—'
    }
    return `${keys.length} key(s)`
  }
  if (typeof value === 'boolean') {
    return value ? 'Enabled' : 'Disabled'
  }
  return String(value)
}

function showStatus(message, isError = false) {
  const badge = document.getElementById('error-message')
  if (!badge) {
    return
  }
  badge.textContent = message
  badge.classList.toggle('error', Boolean(isError))
  badge.style.display = 'inline-flex'
  badge.hidden = false
}

function clearStatus() {
  const badge = document.getElementById('error-message')
  if (!badge) {
    return
  }
  badge.textContent = ''
  badge.style.display = 'none'
  badge.classList.remove('error')
  badge.hidden = true
}
