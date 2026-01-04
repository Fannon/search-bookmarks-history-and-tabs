let optionsSchema

/**
 * Validates user options against the JSON schema.
 *
 * This is a CSP-safe recursive validator that doesn't require eval() or Function().
 * It validates:
 * - Nested objects and properties
 * - Arrays and their items
 * - Type constraints (including multiple types)
 * - Numeric constraints (minimum, maximum)
 * - String constraints (minLength, maxLength, pattern)
 * - Enum constraints
 * - required properties
 * - additionalProperties: false (default behavior for this validator)
 * - anyOf constraints (used for aliases supporting both string and array)
 *
 * @param {Object} options - The options object to validate
 * @returns {Promise<{valid: boolean, errors: string[]}>}
 */
export async function validateOptions(options = {}) {
  if (!optionsSchema) {
    optionsSchema = (await import('../../json/options.schema.json')).default
  }
  const errors = []

  if (options === null || options === undefined) {
    return { valid: true, errors: [] }
  }

  // Start recursive validation from the root
  validateAgainstSchema('', options, optionsSchema, errors)

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Recursively validate a value against a schema
 *
 * @param {string} path - The property path (e.g., 'customSearchEngines[0].alias')
 * @param {any} value - The value to validate
 * @param {Object} schema - The JSON schema slice
 * @param {string[]} errors - The accumulated errors
 */
function validateAgainstSchema(path, value, schema, errors) {
  if (!schema) return

  // 0. Handle $ref (only internal #/definitions/ support)
  if (schema.$ref) {
    const refPath = schema.$ref.replace('#/definitions/', '')
    if (optionsSchema.definitions?.[refPath]) {
      validateAgainstSchema(path, value, optionsSchema.definitions[refPath], errors)
    }
    return
  }

  const displayName = path || 'options'

  // 1. anyOf / oneOf support
  if (schema.anyOf || schema.oneOf) {
    const subSchemas = schema.anyOf || schema.oneOf
    let anyPassed = false
    const subErrors = []
    for (const subSchema of subSchemas) {
      const tempErrors = []
      validateAgainstSchema(path, value, subSchema, tempErrors)
      if (tempErrors.length === 0) {
        anyPassed = true
        break
      }
      subErrors.push(tempErrors.join(', '))
    }
    if (!anyPassed) {
      errors.push(`"${displayName}" must match one of the allowed formats: ${subErrors.join(' OR ')}`)
    }
    return // Skip further validation as anyOf/oneOf covers it
  }

  // 2. Type validation
  if (schema.type) {
    const actualType = getJsonSchemaType(value)
    const allowedTypes = Array.isArray(schema.type) ? schema.type : [schema.type]

    // Special case: 'integer' is a subset of 'number'
    const isNumberMatch = allowedTypes.includes('number') && actualType === 'integer'

    if (!allowedTypes.includes(actualType) && !isNumberMatch) {
      errors.push(`"${displayName}" must be ${allowedTypes.join(' or ')}`)
      return // Stop validating if type is wrong
    }
  }

  // 3. Object-specific validation
  if (getJsonSchemaType(value) === 'object' && schema.properties) {
    const validProperties = new Set(Object.keys(schema.properties))

    // Check for required properties
    if (schema.required) {
      for (const req of schema.required) {
        if (!(req in value)) {
          errors.push(`"${path ? `${path}.` : ''}${req}" is required`)
        }
      }
    }

    // Check for additionalProperties: false (assumed true for this schema unless specified)
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!validProperties.has(key)) {
          errors.push(`Unknown option: "${path ? `${path}.` : ''}${key}"`)
        }
      }
    }

    // Recurse into properties
    for (const [key, propValue] of Object.entries(value)) {
      if (schema.properties[key]) {
        validateAgainstSchema(path ? `${path}.${key}` : key, propValue, schema.properties[key], errors)
      } else if (schema.additionalProperties === false) {
        // Already handled unknown property check above
      }
    }
  }

  // 4. Array-specific validation
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`"${displayName}" must have at least ${schema.minItems} item${schema.minItems === 1 ? '' : 's'}`)
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push(`"${displayName}" must have at most ${schema.maxItems} item${schema.maxItems === 1 ? '' : 's'}`)
    }
    if (schema.items) {
      value.forEach((item, index) => {
        validateAgainstSchema(`${path}[${index}]`, item, schema.items, errors)
      })
    }
  }

  // 5. Numeric constraints
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`"${displayName}" must be >= ${schema.minimum}`)
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`"${displayName}" must be <= ${schema.maximum}`)
    }
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) {
      errors.push(`"${displayName}" must be > ${schema.exclusiveMinimum}`)
    }
    if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) {
      errors.push(`"${displayName}" must be < ${schema.exclusiveMaximum}`)
    }
  }

  // 6. String constraints
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`"${displayName}" must have length >= ${schema.minLength}`)
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push(`"${displayName}" must have length <= ${schema.maxLength}`)
    }
    if (schema.pattern) {
      try {
        const regex = new RegExp(schema.pattern)
        if (!regex.test(value)) {
          errors.push(`"${displayName}" must match pattern ${schema.pattern}`)
        }
      } catch {
        // Invalid regex in schema, skip validation
      }
    }
  }

  // 7. Enum validation
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`"${displayName}" must be one of: ${schema.enum.join(', ')}`)
  }

  // 8. Const validation
  if (schema.const !== undefined && value !== schema.const) {
    errors.push(`"${displayName}" must be exactly: ${schema.const}`)
  }
}

/**
 * Get the JSON Schema type of a JavaScript value
 */
function getJsonSchemaType(value) {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'integer' : 'number'
  }
  return typeof value // 'string', 'boolean', 'object', 'undefined'
}
