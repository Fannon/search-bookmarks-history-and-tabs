import schemasafeModule from './vendor/schemasafe.esm.js'
import { isPlainObject } from '../helper/objectUtils.js'

const validatorCache = new WeakMap()
const customRuleCache = new WeakMap()

const { validator } = schemasafeModule

export function validateOptions(schema, data) {
  const compiled = getValidator(schema)
  const valid = compiled(data)
  const schemaErrors = valid ? [] : compiled.errors || []
  const convertedErrors = schemaErrors.map(convertError)

  const customRules = getCustomRules(schema)
  const customErrors = runCustomRules(customRules, data)

  const errors = [...convertedErrors, ...customErrors]
  return {
    valid: errors.length === 0,
    errors,
  }
}

function getValidator(schema) {
  let compiled = validatorCache.get(schema)
  if (!compiled) {
    compiled = validator(schema, {
      includeErrors: true,
      allErrors: true,
      allowUnusedKeywords: true,
    })
    validatorCache.set(schema, compiled)
  }
  return compiled
}

function getCustomRules(schema) {
  let rules = customRuleCache.get(schema)
  if (!rules) {
    rules = collectCustomRules(schema)
    customRuleCache.set(schema, rules)
  }
  return rules
}

function collectCustomRules(schema, basePath = []) {
  if (!isPlainObject(schema)) {
    return []
  }

  const rules = []
  if (schema['x-allowZeroOrMin'] !== undefined) {
    rules.push({
      path: basePath.join('.'),
      min: schema['x-allowZeroOrMin'],
    })
  }

  if (schema.properties) {
    for (const [key, child] of Object.entries(schema.properties)) {
      rules.push(...collectCustomRules(child, [...basePath, key]))
    }
  }

  if (schema.items) {
    if (Array.isArray(schema.items)) {
      schema.items.forEach((item, index) => {
        rules.push(...collectCustomRules(item, [...basePath, String(index)]))
      })
    } else {
      rules.push(...collectCustomRules(schema.items, [...basePath, '0']))
    }
  }

  return rules
}

function runCustomRules(rules, data) {
  const errors = []
  for (const rule of rules) {
    const value = getValueByPath(data, rule.path)
    if (value === undefined || value === null) {
      continue
    }
    if (typeof value !== 'number') {
      continue
    }
    if (value !== 0 && value < rule.min) {
      errors.push({
        path: rule.path,
        message: `Must be 0 or at least ${rule.min}`,
      })
    }
  }
  return errors
}

function getValueByPath(object, path) {
  if (!path) {
    return object
  }
  const segments = path.split('.')
  return segments.reduce((current, segment) => {
    if (current === undefined || current === null) {
      return undefined
    }
    if (Array.isArray(current)) {
      return current[Number(segment)]
    }
    return current[segment]
  }, object)
}

function convertError(error) {
  const pointer = error.instanceLocation || error.dataPath || '#'
  return {
    path: pointerToPath(pointer),
    message: error.error || 'Invalid value',
  }
}

function pointerToPath(pointer) {
  if (!pointer || pointer === '#' || pointer === '') {
    return ''
  }
  return pointer
    .replace(/^#\//, '')
    .split('/')
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'))
    .join('.')
}
