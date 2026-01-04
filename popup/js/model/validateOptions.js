import optionsSchema from '../../json/options.schema.json' with { type: 'json' }

let validatorFn
let validatorPromise

const sanitizedOptionsSchema = sanitizeSchema(optionsSchema)

export async function validateOptions(
  options = {
    allErrors: true,
  },
) {
  const validate = await getValidator()
  const isValid = validate(options)

  if (isValid) {
    return { valid: true, errors: [] }
  }

  const rawErrors = Array.isArray(validate.errors) ? validate.errors : []
  const errors = rawErrors.map(formatValidationError).filter(Boolean)

  return {
    valid: false,
    errors,
  }
}

async function getValidator() {
  if (validatorFn) {
    return validatorFn
  }

  if (!validatorPromise) {
    validatorPromise = (async () => {
      const { validator } = await loadSchemasafe()
      if (typeof validator !== 'function') {
        throw new Error('schemasafe validator is not available')
      }
      return validator(sanitizedOptionsSchema, {
        includeErrors: true,
        allErrors: true,
      })
    })()
  }

  validatorFn = await validatorPromise
  return validatorFn
}

async function loadSchemasafe() {
  if (typeof globalThis !== 'undefined' && globalThis.schemasafe) {
    return globalThis.schemasafe
  }

  const schemaModule = await import('@exodus/schemasafe')
  return schemaModule.default ?? schemaModule
}

function formatValidationError(error) {
  if (!error) {
    return ''
  }

  const instancePathSegments = parseJsonPointer(error.instanceLocation)
  const instancePath = pointerSegmentsToPath(instancePathSegments)
  const keywordPathSegments = parseJsonPointer(error.keywordLocation)
  const keyword = keywordPathSegments[keywordPathSegments.length - 1]
  const schemaValue = getSchemaValue(keywordPathSegments)

  switch (keyword) {
    case 'minimum':
      return `${instancePath || 'options'} must be >= ${schemaValue}`
    case 'maximum':
      return `${instancePath || 'options'} must be <= ${schemaValue}`
    case 'exclusiveMinimum':
      return `${instancePath || 'options'} must be > ${schemaValue}`
    case 'exclusiveMaximum':
      return `${instancePath || 'options'} must be < ${schemaValue}`
    case 'minLength':
      return `${instancePath || 'options'} must have length >= ${schemaValue}`
    case 'maxLength':
      return `${instancePath || 'options'} must have length <= ${schemaValue}`
    case 'minItems':
      return `${instancePath || 'options'} must contain at least ${schemaValue} item${schemaValue === 1 ? '' : 's'}`
    case 'maxItems':
      return `${instancePath || 'options'} must contain no more than ${schemaValue} item${schemaValue === 1 ? '' : 's'}`
    case 'type':
      return `${instancePath || 'options'} must be of type ${Array.isArray(schemaValue) ? schemaValue.join(' or ') : schemaValue}`
    case 'enum':
      return `${instancePath || 'options'} must be one of ${Array.isArray(schemaValue) ? schemaValue.join(', ') : schemaValue}`
    case 'pattern':
      return `${instancePath || 'options'} must match pattern ${schemaValue}`
    case 'required':
      return 'A required property is missing'
    case 'additionalProperties': {
      const offending = instancePathSegments[instancePathSegments.length - 1]
      return offending ? `${offending} is not allowed` : 'Unexpected property is not allowed'
    }
    case 'minProperties':
      return `${instancePath || 'options'} must have at least ${schemaValue} property${schemaValue === 1 ? '' : 'ies'}`
    case 'maxProperties':
      return `${instancePath || 'options'} must have no more than ${schemaValue} properties`
    default:
      return instancePath ? `${instancePath} is invalid` : 'Options failed schema validation'
  }
}

function parseJsonPointer(pointer) {
  if (!pointer || pointer === '#') {
    return []
  }

  const trimmed = pointer.startsWith('#/') ? pointer.slice(2) : pointer.slice(1)
  if (!trimmed) {
    return []
  }

  return trimmed.split('/').map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'))
}

function pointerSegmentsToPath(segments) {
  if (!segments.length) {
    return ''
  }

  return segments.reduce((path, segment, index) => {
    if (/^\d+$/.test(segment)) {
      return `${path}[${segment}]`
    }
    return index === 0 ? segment : `${path}.${segment}`
  }, '')
}

function getSchemaValue(pointerSegments) {
  if (!pointerSegments.length) {
    return undefined
  }

  let current = sanitizedOptionsSchema
  for (const segment of pointerSegments) {
    if (current && typeof current === 'object' && segment in current) {
      current = current[segment]
    } else {
      return undefined
    }
  }

  return current
}

function sanitizeSchema(schema) {
  return JSON.parse(
    JSON.stringify(schema, (key, value) => {
      if (typeof key === 'string' && key.startsWith('x-')) {
        return undefined
      }
      return value
    }),
  )
}
