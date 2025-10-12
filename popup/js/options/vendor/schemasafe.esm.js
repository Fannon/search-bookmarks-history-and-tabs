var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// node_modules/@exodus/schemasafe/src/safe-format.js
var require_safe_format = __commonJS({
  "node_modules/@exodus/schemasafe/src/safe-format.js"(exports, module) {
    "use strict";
    var SafeString = class extends String {
    };
    var compares = /* @__PURE__ */ new Set(["<", ">", "<=", ">="]);
    var escapeCode = (code) => `\\u${code.toString(16).padStart(4, "0")}`;
    var jsval = (val) => {
      if ([Infinity, -Infinity, NaN, void 0, null].includes(val)) return `${val}`;
      const primitive = ["string", "boolean", "number"].includes(typeof val);
      if (!primitive) {
        if (typeof val !== "object") throw new Error("Unexpected value type");
        const proto = Object.getPrototypeOf(val);
        const ok = proto === Array.prototype && Array.isArray(val) || proto === Object.prototype;
        if (!ok) throw new Error("Unexpected object given as value");
      }
      return JSON.stringify(val).replace(/([{,])"__proto__":/g, '$1["__proto__"]:').replace(/[^\\]"__proto__":/g, () => {
        throw new Error("Unreachable");
      }).replace(/[\u2028\u2029]/g, (char) => escapeCode(char.charCodeAt(0)));
    };
    var format = (fmt, ...args) => {
      const res = fmt.replace(/%[%drscjw]/g, (match) => {
        if (match === "%%") return "%";
        if (args.length === 0) throw new Error("Unexpected arguments count");
        const val = args.shift();
        switch (match) {
          case "%d":
            if (typeof val === "number") return val;
            throw new Error("Expected a number");
          case "%r":
            if (val instanceof RegExp) return format("new RegExp(%j, %j)", val.source, val.flags);
            throw new Error("Expected a RegExp instance");
          case "%s":
            if (val instanceof SafeString) return val;
            throw new Error("Expected a safe string");
          case "%c":
            if (compares.has(val)) return val;
            throw new Error("Expected a compare op");
          case "%j":
            return jsval(val);
          case "%w":
            if (Number.isInteger(val) && val >= 0) return " ".repeat(val);
            throw new Error("Expected a non-negative integer for indentation");
        }
        throw new Error("Unreachable");
      });
      if (args.length !== 0) throw new Error("Unexpected arguments count");
      return new SafeString(res);
    };
    var safe = (string) => {
      if (!/^[a-z][a-z0-9_]*$/i.test(string)) throw new Error("Does not look like a safe id");
      return new SafeString(string);
    };
    var safewrap = (fun) => (...args) => {
      if (!args.every((arg) => arg instanceof SafeString)) throw new Error("Unsafe arguments");
      return new SafeString(fun(...args));
    };
    var safepriority = (arg) => (
      // simple expression and single brackets can not break priority
      /^[a-z][a-z0-9_().]*$/i.test(arg) || /^\([^()]+\)$/i.test(arg) ? arg : format("(%s)", arg)
    );
    var safeor = safewrap(
      (...args) => args.some((arg) => `${arg}` === "true") ? "true" : args.join(" || ") || "false"
    );
    var safeand = safewrap(
      (...args) => args.some((arg) => `${arg}` === "false") ? "false" : args.join(" && ") || "true"
    );
    var safenot = (arg) => {
      if (`${arg}` === "true") return safe("false");
      if (`${arg}` === "false") return safe("true");
      return format("!%s", safepriority(arg));
    };
    var safenotor = (...args) => safenot(safeor(...args));
    module.exports = { format, safe, safeand, safenot, safenotor };
  }
});

// node_modules/@exodus/schemasafe/src/scope-utils.js
var require_scope_utils = __commonJS({
  "node_modules/@exodus/schemasafe/src/scope-utils.js"(exports, module) {
    "use strict";
    var { safe } = require_safe_format();
    var caches = /* @__PURE__ */ new WeakMap();
    var scopeMethods = (scope) => {
      if (!caches.has(scope))
        caches.set(scope, { sym: /* @__PURE__ */ new Map(), ref: /* @__PURE__ */ new Map(), format: /* @__PURE__ */ new Map(), pattern: /* @__PURE__ */ new Map() });
      const cache = caches.get(scope);
      const gensym = (name) => {
        if (!cache.sym.get(name)) cache.sym.set(name, 0);
        const index = cache.sym.get(name);
        cache.sym.set(name, index + 1);
        return safe(`${name}${index}`);
      };
      const genpattern = (p) => {
        if (cache.pattern.has(p)) return cache.pattern.get(p);
        const n = gensym("pattern");
        scope[n] = new RegExp(p, "u");
        cache.pattern.set(p, n);
        return n;
      };
      if (!cache.loop) cache.loop = "ijklmnopqrstuvxyz".split("");
      const genloop = () => {
        const v = cache.loop.shift();
        cache.loop.push(`${v}${v[0]}`);
        return safe(v);
      };
      const getref = (sub) => cache.ref.get(sub);
      const genref = (sub) => {
        const n = gensym("ref");
        cache.ref.set(sub, n);
        return n;
      };
      const genformat = (impl) => {
        let n = cache.format.get(impl);
        if (!n) {
          n = gensym("format");
          scope[n] = impl;
          cache.format.set(impl, n);
        }
        return n;
      };
      return { gensym, genpattern, genloop, getref, genref, genformat };
    };
    module.exports = { scopeMethods };
  }
});

// node_modules/@exodus/schemasafe/src/scope-functions.js
var require_scope_functions = __commonJS({
  "node_modules/@exodus/schemasafe/src/scope-functions.js"(exports, module) {
    "use strict";
    var stringLength = (string) => /[\uD800-\uDFFF]/.test(string) ? [...string].length : string.length;
    var isMultipleOf = (value, divisor, factor, factorMultiple) => {
      if (value % divisor === 0) return true;
      let multiple = value * factor;
      if (multiple === Infinity || multiple === -Infinity) multiple = value;
      if (multiple % factorMultiple === 0) return true;
      const normal = Math.floor(multiple + 0.5);
      return normal / factor === value && normal % factorMultiple === 0;
    };
    var deepEqual = (obj, obj2) => {
      if (obj === obj2) return true;
      if (!obj || !obj2 || typeof obj !== typeof obj2) return false;
      if (obj !== obj2 && typeof obj !== "object") return false;
      const proto = Object.getPrototypeOf(obj);
      if (proto !== Object.getPrototypeOf(obj2)) return false;
      if (proto === Array.prototype) {
        if (!Array.isArray(obj) || !Array.isArray(obj2)) return false;
        if (obj.length !== obj2.length) return false;
        return obj.every((x, i) => deepEqual(x, obj2[i]));
      } else if (proto === Object.prototype) {
        const [keys, keys2] = [Object.keys(obj), Object.keys(obj2)];
        if (keys.length !== keys2.length) return false;
        const keyset2 = /* @__PURE__ */ new Set([...keys, ...keys2]);
        return keyset2.size === keys.length && keys.every((key) => deepEqual(obj[key], obj2[key]));
      }
      return false;
    };
    var unique = (array) => {
      if (array.length < 2) return true;
      if (array.length === 2) return !deepEqual(array[0], array[1]);
      const objects = [];
      const primitives = array.length > 20 ? /* @__PURE__ */ new Set() : null;
      let primitivesCount = 0;
      let pos = 0;
      for (const item of array) {
        if (typeof item === "object") {
          objects.push(item);
        } else if (primitives) {
          primitives.add(item);
          if (primitives.size !== ++primitivesCount) return false;
        } else {
          if (array.indexOf(item, pos + 1) !== -1) return false;
        }
        pos++;
      }
      for (let i = 1; i < objects.length; i++)
        for (let j = 0; j < i; j++) if (deepEqual(objects[i], objects[j])) return false;
      return true;
    };
    var deBase64 = (string) => {
      if (typeof Buffer !== "undefined") return Buffer.from(string, "base64").toString("utf-8");
      const b = atob(string);
      return new TextDecoder("utf-8").decode(new Uint8Array(b.length).map((_, i) => b.charCodeAt(i)));
    };
    var hasOwn = Function.prototype.call.bind(Object.prototype.hasOwnProperty);
    hasOwn[Symbol.for("toJayString")] = "Function.prototype.call.bind(Object.prototype.hasOwnProperty)";
    var pointerPart = (s) => /~\//.test(s) ? `${s}`.replace(/~/g, "~0").replace(/\//g, "~1") : s;
    var toPointer = (path) => path.length === 0 ? "#" : `#/${path.map(pointerPart).join("/")}`;
    var errorMerge = ({ keywordLocation, instanceLocation }, schemaBase, dataBase) => ({
      keywordLocation: `${schemaBase}${keywordLocation.slice(1)}`,
      instanceLocation: `${dataBase}${instanceLocation.slice(1)}`
    });
    var propertyIn = (key, [properties, patterns]) => properties.includes(true) || properties.some((prop) => prop === key) || patterns.some((pattern) => new RegExp(pattern, "u").test(key));
    var dynamicResolve = (anchors, id) => (anchors.filter((x) => x[id])[0] || {})[id];
    var extraUtils = { toPointer, pointerPart, errorMerge, propertyIn, dynamicResolve };
    module.exports = { stringLength, isMultipleOf, deepEqual, unique, deBase64, hasOwn, ...extraUtils };
  }
});

// node_modules/@exodus/schemasafe/src/javascript.js
var require_javascript = __commonJS({
  "node_modules/@exodus/schemasafe/src/javascript.js"(exports, module) {
    "use strict";
    var { format, safe } = require_safe_format();
    var { scopeMethods } = require_scope_utils();
    var functions = require_scope_functions();
    var types = new Map(
      Object.entries({
        null: (name) => format("%s === null", name),
        boolean: (name) => format('typeof %s === "boolean"', name),
        array: (name) => format("Array.isArray(%s)", name),
        object: (n) => format('typeof %s === "object" && %s && !Array.isArray(%s)', n, n, n),
        number: (name) => format('typeof %s === "number"', name),
        integer: (name) => format("Number.isInteger(%s)", name),
        string: (name) => format('typeof %s === "string"', name)
      })
    );
    var buildName = ({ name, parent, keyval, keyname }) => {
      if (name) {
        if (parent || keyval || keyname) throw new Error("name can be used only stand-alone");
        return name;
      }
      if (!parent) throw new Error("Can not use property of undefined parent!");
      const parentName = buildName(parent);
      if (keyval !== void 0) {
        if (keyname) throw new Error("Can not use key value and name together");
        if (!["string", "number"].includes(typeof keyval)) throw new Error("Invalid property path");
        if (/^[a-z][a-z0-9_]*$/i.test(keyval)) return format("%s.%s", parentName, safe(keyval));
        return format("%s[%j]", parentName, keyval);
      } else if (keyname) {
        return format("%s[%s]", parentName, keyname);
      }
      throw new Error("Unreachable");
    };
    var jsonProtoKeys = new Set(
      [].concat(
        ...[Object, Array, String, Number, Boolean].map((c) => Object.getOwnPropertyNames(c.prototype))
      )
    );
    var jsHelpers = (fun, scope, propvar, { unmodifiedPrototypes, isJSON }, noopRegExps) => {
      const { gensym, genpattern, genloop } = scopeMethods(scope, propvar);
      const present = (obj) => {
        const name = buildName(obj);
        const { parent, keyval, keyname, inKeys, checked } = obj;
        if (checked || inKeys && isJSON) throw new Error("Unreachable: useless check for undefined");
        if (inKeys) return format("%s !== undefined", name);
        if (parent && keyname) {
          scope.hasOwn = functions.hasOwn;
          const pname = buildName(parent);
          if (isJSON) return format("%s !== undefined && hasOwn(%s, %s)", name, pname, keyname);
          return format("%s in %s && hasOwn(%s, %s)", keyname, pname, pname, keyname);
        } else if (parent && keyval !== void 0) {
          if (unmodifiedPrototypes && isJSON && !jsonProtoKeys.has(`${keyval}`))
            return format("%s !== undefined", name);
          scope.hasOwn = functions.hasOwn;
          const pname = buildName(parent);
          if (isJSON) return format("%s !== undefined && hasOwn(%s, %j)", name, pname, keyval);
          return format("%j in %s && hasOwn(%s, %j)", keyval, pname, pname, keyval);
        }
        throw new Error("Unreachable: present() check without parent");
      };
      const forObjectKeys = (obj, writeBody) => {
        const key = gensym("key");
        fun.block(format("for (const %s of Object.keys(%s))", key, buildName(obj)), () => {
          writeBody(propvar(obj, key, true), key);
        });
      };
      const forArray = (obj, start, writeBody) => {
        const i = genloop();
        const name = buildName(obj);
        fun.block(format("for (let %s = %s; %s < %s.length; %s++)", i, start, i, name, i), () => {
          writeBody(propvar(obj, i, unmodifiedPrototypes, true), i);
        });
      };
      const patternTest = (pat, key) => {
        const r = pat.replace(/[.^$|*+?(){}[\]\\]/gu, "");
        if (pat === `^${r}$`) return format("(%s === %j)", key, pat.slice(1, -1));
        if (noopRegExps.has(pat)) return format("true");
        if ([r, `${r}+`, `${r}.*`, `.*${r}.*`].includes(pat)) return format("%s.includes(%j)", key, r);
        if ([`^${r}`, `^${r}+`, `^${r}.*`].includes(pat)) return format("%s.startsWith(%j)", key, r);
        if ([`${r}$`, `.*${r}$`].includes(pat)) return format("%s.endsWith(%j)", key, r);
        const subr = [...r].slice(0, -1).join("");
        if ([`${r}*`, `${r}?`].includes(pat))
          return subr.length === 0 ? format("true") : format("%s.includes(%j)", key, subr);
        if ([`^${r}*`, `^${r}?`].includes(pat))
          return subr.length === 0 ? format("true") : format("%s.startsWith(%j)", key, subr);
        return format("%s.test(%s)", genpattern(pat), key);
      };
      const compare = (name, val) => {
        if (!val || typeof val !== "object") return format("%s === %j", name, val);
        let type;
        const shouldInline = (arr) => arr.length <= 3 && arr.every((x) => !x || typeof x !== "object");
        if (Array.isArray(val)) {
          type = types.get("array")(name);
          if (shouldInline(val)) {
            let k = format("%s.length === %d", name, val.length);
            for (let i = 0; i < val.length; i++) k = format("%s && %s[%d] === %j", k, name, i, val[i]);
            return format("%s && %s", type, k);
          }
        } else {
          type = types.get("object")(name);
          const [keys, values] = [Object.keys(val), Object.values(val)];
          if (shouldInline(values)) {
            let k = format("Object.keys(%s).length === %d", name, keys.length);
            if (keys.length > 0) scope.hasOwn = functions.hasOwn;
            for (const key of keys) k = format("%s && hasOwn(%s, %j)", k, name, key);
            for (const key of keys) k = format("%s && %s[%j] === %j", k, name, key, val[key]);
            return format("%s && %s", type, k);
          }
        }
        scope.deepEqual = functions.deepEqual;
        return format("%s && deepEqual(%s, %j)", type, name, val);
      };
      return { present, forObjectKeys, forArray, patternTest, compare, propvar };
    };
    var isArrowFnWithParensRegex = /^\([^)]*\) *=>/;
    var isArrowFnWithoutParensRegex = /^[^=]*=>/;
    var toJayString = Symbol.for("toJayString");
    function jaystring(item) {
      if (typeof item === "function") {
        if (item[toJayString]) return item[toJayString];
        if (Object.getPrototypeOf(item) !== Function.prototype)
          throw new Error("Can not stringify: a function with unexpected prototype");
        const stringified = `${item}`;
        if (item.prototype) {
          if (!/^function[ (]/.test(stringified)) throw new Error("Unexpected function");
          return stringified;
        }
        if (isArrowFnWithParensRegex.test(stringified) || isArrowFnWithoutParensRegex.test(stringified))
          return stringified;
        throw new Error("Can not stringify: only either normal or arrow functions are supported");
      } else if (typeof item === "object") {
        const proto = Object.getPrototypeOf(item);
        if (item instanceof RegExp && proto === RegExp.prototype) return format("%r", item);
        throw new Error("Can not stringify: an object with unexpected prototype");
      }
      throw new Error(`Can not stringify: unknown type ${typeof item}`);
    }
    module.exports = { types, buildName, jsHelpers, jaystring };
  }
});

// node_modules/@exodus/schemasafe/src/generate-function.js
var require_generate_function = __commonJS({
  "node_modules/@exodus/schemasafe/src/generate-function.js"(exports, module) {
    "use strict";
    var { format, safe, safenot } = require_safe_format();
    var { jaystring } = require_javascript();
    var INDENT_START = /[{[]/;
    var INDENT_END = /[}\]]/;
    module.exports = () => {
      const lines = [];
      let indent = 0;
      const pushLine = (line) => {
        if (INDENT_END.test(line.trim()[0])) indent--;
        lines.push({ indent, code: line });
        if (INDENT_START.test(line[line.length - 1])) indent++;
      };
      const build = () => {
        if (indent !== 0) throw new Error("Unexpected indent at build()");
        const joined = lines.map((line) => format("%w%s", line.indent * 2, line.code)).join("\n");
        return /^[a-z][a-z0-9]*$/i.test(joined) ? `return ${joined}` : `return (${joined})`;
      };
      const processScope = (scope) => {
        const entries = Object.entries(scope);
        for (const [key, value] of entries) {
          if (!/^[a-z][a-z0-9]*$/i.test(key)) throw new Error("Unexpected scope key!");
          if (!(typeof value === "function" || value instanceof RegExp))
            throw new Error("Unexpected scope value!");
        }
        return entries;
      };
      return {
        optimizedOut: false,
        // some branch of code has been optimized out
        size: () => lines.length,
        write(fmt, ...args) {
          if (typeof fmt !== "string") throw new Error("Format must be a string!");
          if (fmt.includes("\n")) throw new Error("Only single lines are supported");
          pushLine(format(fmt, ...args));
          return true;
        },
        block(prefix, writeBody, noInline = false) {
          const oldIndent = indent;
          this.write("%s {", prefix);
          const length = lines.length;
          writeBody();
          if (length === lines.length) {
            lines.pop();
            indent = oldIndent;
            return false;
          } else if (length === lines.length - 1 && !noInline) {
            const { code } = lines[lines.length - 1];
            if (!/^(if|for) /.test(code)) {
              lines.length -= 2;
              indent = oldIndent;
              return this.write("%s %s", prefix, code);
            }
          }
          return this.write("}");
        },
        if(condition, writeBody, writeElse) {
          if (`${condition}` === "false") {
            if (writeElse) writeElse();
            if (writeBody) this.optimizedOut = true;
          } else if (`${condition}` === "true") {
            if (writeBody) writeBody();
            if (writeElse) this.optimizedOut = true;
          } else if (writeBody && this.block(format("if (%s)", condition), writeBody, !!writeElse)) {
            if (writeElse) this.block(format("else"), writeElse);
          } else if (writeElse) {
            this.if(safenot(condition), writeElse);
          }
        },
        makeModule(scope = {}) {
          const scopeDefs = processScope(scope).map(
            ([key, val]) => `const ${safe(key)} = ${jaystring(val)};`
          );
          return `(function() {
'use strict'
${scopeDefs.join("\n")}
${build()}})()`;
        },
        makeFunction(scope = {}) {
          const scopeEntries = processScope(scope);
          const keys = scopeEntries.map((entry) => entry[0]);
          const vals = scopeEntries.map((entry) => entry[1]);
          return Function(...keys, `'use strict'
${build()}`)(...vals);
        }
      };
    };
  }
});

// node_modules/@exodus/schemasafe/src/known-keywords.js
var require_known_keywords = __commonJS({
  "node_modules/@exodus/schemasafe/src/known-keywords.js"(exports, module) {
    "use strict";
    var knownKeywords = [
      ...["$schema", "$vocabulary"],
      // version
      ...["id", "$id", "$anchor", "$ref", "definitions", "$defs"],
      // pointers
      ...["$recursiveRef", "$recursiveAnchor", "$dynamicAnchor", "$dynamicRef"],
      ...["type", "required", "default"],
      // generic
      ...["enum", "const"],
      // constant values
      ...["not", "allOf", "anyOf", "oneOf", "if", "then", "else"],
      // logical checks
      ...["maximum", "minimum", "exclusiveMaximum", "exclusiveMinimum", "multipleOf", "divisibleBy"],
      // numbers
      ...["items", "maxItems", "minItems", "additionalItems", "prefixItems"],
      // arrays, basic
      ...["contains", "minContains", "maxContains", "uniqueItems"],
      // arrays, complex
      ...["maxLength", "minLength", "format", "pattern"],
      // strings
      ...["contentEncoding", "contentMediaType", "contentSchema"],
      // strings content
      ...["properties", "maxProperties", "minProperties", "additionalProperties", "patternProperties"],
      // objects
      ...["propertyNames"],
      // objects
      ...["dependencies", "dependentRequired", "dependentSchemas", "propertyDependencies"],
      // objects (dependencies)
      ...["unevaluatedProperties", "unevaluatedItems"],
      // see-through
      // Unused meta keywords not affecting validation (annotations and comments)
      // https://json-schema.org/understanding-json-schema/reference/generic.html
      // https://json-schema.org/draft/2019-09/json-schema-validation.html#rfc.section.9
      ...["title", "description", "deprecated", "readOnly", "writeOnly", "examples", "$comment"],
      // unused meta
      ...["example"],
      // unused meta, OpenAPI
      "discriminator",
      // optimization hint and error filtering only, does not affect validation result
      "removeAdditional"
      // optional keyword for { removeAdditional: 'keyword' } config, to target specific objects
    ];
    var schemaDrafts = [
      ...["draft/next"],
      // not recommended to use, might change / break in an unexpected way
      ...["draft/2020-12", "draft/2019-09"],
      // new
      ...["draft-07", "draft-06", "draft-04", "draft-03"]
      // historic
    ];
    var schemaVersions = schemaDrafts.map((draft) => `https://json-schema.org/${draft}/schema`);
    var vocab2019 = ["core", "applicator", "validation", "meta-data", "format", "content"];
    var vocab2020 = [
      ...["core", "applicator", "unevaluated", "validation"],
      ...["meta-data", "format-annotation", "format-assertion", "content"]
    ];
    var knownVocabularies = [
      ...vocab2019.map((v) => `https://json-schema.org/draft/2019-09/vocab/${v}`),
      ...vocab2020.map((v) => `https://json-schema.org/draft/2020-12/vocab/${v}`)
    ];
    module.exports = { knownKeywords, schemaVersions, knownVocabularies };
  }
});

// node_modules/@exodus/schemasafe/src/pointer.js
var require_pointer = __commonJS({
  "node_modules/@exodus/schemasafe/src/pointer.js"(exports, module) {
    "use strict";
    var { knownKeywords } = require_known_keywords();
    function safeSet(map, key, value, comment = "keys") {
      if (!map.has(key)) return map.set(key, value);
      if (map.get(key) !== value) throw new Error(`Conflicting duplicate ${comment}: ${key}`);
    }
    function untilde(string) {
      if (!string.includes("~")) return string;
      return string.replace(/~[01]/g, (match) => {
        switch (match) {
          case "~1":
            return "/";
          case "~0":
            return "~";
        }
        throw new Error("Unreachable");
      });
    }
    function get(obj, pointer, objpath) {
      if (typeof obj !== "object") throw new Error("Invalid input object");
      if (typeof pointer !== "string") throw new Error("Invalid JSON pointer");
      const parts = pointer.split("/");
      if (!["", "#"].includes(parts.shift())) throw new Error("Invalid JSON pointer");
      if (parts.length === 0) return obj;
      let curr = obj;
      for (const part of parts) {
        if (typeof part !== "string") throw new Error("Invalid JSON pointer");
        if (objpath) objpath.push(curr);
        const prop = untilde(part);
        if (typeof curr !== "object") return void 0;
        if (!Object.prototype.hasOwnProperty.call(curr, prop)) return void 0;
        curr = curr[prop];
      }
      return curr;
    }
    var protocolRegex = /^https?:\/\//;
    function joinPath(baseFull, sub) {
      if (typeof baseFull !== "string" || typeof sub !== "string") throw new Error("Unexpected path!");
      if (sub.length === 0) return baseFull;
      const base = baseFull.replace(/#.*/, "");
      if (sub.startsWith("#")) return `${base}${sub}`;
      if (!base.includes("/") || protocolRegex.test(sub)) return sub;
      if (protocolRegex.test(base)) return `${new URL(sub, base)}`;
      if (sub.startsWith("/")) return sub;
      return [...base.split("/").slice(0, -1), sub].join("/");
    }
    function objpath2path(objpath) {
      const ids = objpath.map((obj) => obj && (obj.$id || obj.id) || "");
      return ids.filter((id) => id && typeof id === "string").reduce(joinPath, "");
    }
    var withSpecialChilds = ["properties", "patternProperties", "$defs", "definitions"];
    var skipChilds = ["const", "enum", "examples", "example", "comment"];
    var sSkip = Symbol("skip");
    function traverse(schema, work) {
      const visit = (sub, specialChilds = false) => {
        if (!sub || typeof sub !== "object") return;
        const res = work(sub);
        if (res !== void 0) return res === sSkip ? void 0 : res;
        for (const k of Object.keys(sub)) {
          if (!specialChilds && !Array.isArray(sub) && !knownKeywords.includes(k)) continue;
          if (!specialChilds && skipChilds.includes(k)) continue;
          const kres = visit(sub[k], !specialChilds && withSpecialChilds.includes(k));
          if (kres !== void 0) return kres;
        }
      };
      return visit(schema);
    }
    function resolveReference(root, schemas, ref, base = "") {
      const ptr = joinPath(base, ref);
      const results = [];
      const [main, hash = ""] = ptr.split("#");
      const local = decodeURI(hash);
      const visit = (sub, oldPath, specialChilds = false, dynamic = false) => {
        if (!sub || typeof sub !== "object") return;
        const id = sub.$id || sub.id;
        let path = oldPath;
        if (id && typeof id === "string") {
          path = joinPath(path, id);
          if (path === ptr || path === main && local === "") {
            results.push([sub, root, oldPath]);
          } else if (path === main && local[0] === "/") {
            const objpath = [];
            const res = get(sub, local, objpath);
            if (res !== void 0) results.push([res, root, joinPath(oldPath, objpath2path(objpath))]);
          }
        }
        const anchor = dynamic ? sub.$dynamicAnchor : sub.$anchor;
        if (anchor && typeof anchor === "string") {
          if (anchor.includes("#")) throw new Error("$anchor can't include '#'");
          if (anchor.startsWith("/")) throw new Error("$anchor can't start with '/'");
          path = joinPath(path, `#${anchor}`);
          if (path === ptr) results.push([sub, root, oldPath]);
        }
        for (const k of Object.keys(sub)) {
          if (!specialChilds && !Array.isArray(sub) && !knownKeywords.includes(k)) continue;
          if (!specialChilds && skipChilds.includes(k)) continue;
          visit(sub[k], path, !specialChilds && withSpecialChilds.includes(k));
        }
        if (!dynamic && sub.$dynamicAnchor) visit(sub, oldPath, specialChilds, true);
      };
      visit(root, main);
      if (main === base.replace(/#$/, "") && (local[0] === "/" || local === "")) {
        const objpath = [];
        const res = get(root, local, objpath);
        if (res !== void 0) results.push([res, root, objpath2path(objpath)]);
      }
      if (schemas.has(main) && schemas.get(main) !== root) {
        const additional = resolveReference(schemas.get(main), schemas, `#${hash}`, main);
        results.push(...additional.map(([res, rRoot, rPath]) => [res, rRoot, joinPath(main, rPath)]));
      }
      if (schemas.has(ptr)) results.push([schemas.get(ptr), schemas.get(ptr), ptr]);
      return results;
    }
    function getDynamicAnchors(schema) {
      const results = /* @__PURE__ */ new Map();
      traverse(schema, (sub) => {
        if (sub !== schema && (sub.$id || sub.id)) return sSkip;
        const anchor = sub.$dynamicAnchor;
        if (anchor && typeof anchor === "string") {
          if (anchor.includes("#")) throw new Error("$dynamicAnchor can't include '#'");
          if (!/^[a-zA-Z0-9_-]+$/.test(anchor)) throw new Error(`Unsupported $dynamicAnchor: ${anchor}`);
          safeSet(results, anchor, sub, "$dynamicAnchor");
        }
      });
      return results;
    }
    var hasKeywords = (schema, keywords) => traverse(schema, (s) => Object.keys(s).some((k) => keywords.includes(k)) || void 0) || false;
    var addSchemasArrayToMap = (schemas, input, optional = false) => {
      if (!Array.isArray(input)) throw new Error("Expected an array of schemas");
      for (const schema of input) {
        traverse(schema, (sub) => {
          const idRaw = sub.$id || sub.id;
          const id = idRaw && typeof idRaw === "string" ? idRaw.replace(/#$/, "") : null;
          if (id && id.includes("://") && !id.includes("#")) {
            safeSet(schemas, id, sub, "schema $id in 'schemas'");
          } else if (sub === schema && !optional) {
            throw new Error("Schema with missing or invalid $id in 'schemas'");
          }
        });
      }
      return schemas;
    };
    var buildSchemas = (input, extra) => {
      if (extra) return addSchemasArrayToMap(buildSchemas(input), extra, true);
      if (input) {
        switch (Object.getPrototypeOf(input)) {
          case Object.prototype:
            return new Map(Object.entries(input));
          case Map.prototype:
            return new Map(input);
          case Array.prototype:
            return addSchemasArrayToMap(/* @__PURE__ */ new Map(), input);
        }
      }
      throw new Error("Unexpected value for 'schemas' option");
    };
    module.exports = { get, joinPath, resolveReference, getDynamicAnchors, hasKeywords, buildSchemas };
  }
});

// node_modules/@exodus/schemasafe/src/formats.js
var require_formats = __commonJS({
  "node_modules/@exodus/schemasafe/src/formats.js"(exports, module) {
    "use strict";
    var core = {
      // matches ajv + length checks + does not start with a dot
      // note that quoted emails are deliberately unsupported (as in ajv), who would want \x01 in email
      // first check is an additional fast path with lengths: 20+(1+21)*2 = 64, (1+61+1)+((1+60+1)+1)*3 = 252 < 253, that should cover most valid emails
      // max length is 64 (name) + 1 (@) + 253 (host), we want to ensure that prior to feeding to the fast regex
      // the second regex checks for quoted, starting-leading dot in name, and two dots anywhere
      email: (input) => {
        if (input.length > 318) return false;
        const fast = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]{1,20}(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]{1,21}){0,2}@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,60}[a-z0-9])?){0,3}$/i;
        if (fast.test(input)) return true;
        if (!input.includes("@") || /(^\.|^"|\.@|\.\.)/.test(input)) return false;
        const [name, host, ...rest] = input.split("@");
        if (!name || !host || rest.length !== 0 || name.length > 64 || host.length > 253) return false;
        if (!/^[a-z0-9.-]+$/i.test(host) || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(name)) return false;
        return host.split(".").every((part) => /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i.test(part));
      },
      // matches ajv + length checks
      hostname: (input) => {
        if (input.length > (input.endsWith(".") ? 254 : 253)) return false;
        const hostname = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.?$/i;
        return hostname.test(input);
      },
      // 'time' matches ajv + length checks, 'date' matches ajv full
      // date: https://tools.ietf.org/html/rfc3339#section-5.6
      // date-time: https://tools.ietf.org/html/rfc3339#section-5.6
      // leap year: https://tools.ietf.org/html/rfc3339#appendix-C
      // 11: 1990-01-01, 1: T, 9: 00:00:00., 12: maxiumum fraction length (non-standard), 6: +00:00
      date: (input) => {
        if (input.length !== 10) return false;
        if (input[5] === "0" && input[6] === "2") {
          if (/^\d\d\d\d-02-(?:[012][1-8]|[12]0|[01]9)$/.test(input)) return true;
          const matches = input.match(/^(\d\d\d\d)-02-29$/);
          if (!matches) return false;
          const year = matches[1] | 0;
          return year % 16 === 0 || year % 4 === 0 && year % 25 !== 0;
        }
        if (input.endsWith("31")) return /^\d\d\d\d-(?:0[13578]|1[02])-31$/.test(input);
        return /^\d\d\d\d-(?:0[13-9]|1[012])-(?:[012][1-9]|[123]0)$/.test(input);
      },
      // leap second handling is special, we check it's 23:59:60.*
      time: (input) => {
        if (input.length > 9 + 12 + 6) return false;
        const time = /^(?:2[0-3]|[0-1]\d):[0-5]\d:(?:[0-5]\d|60)(?:\.\d+)?(?:z|[+-](?:2[0-3]|[0-1]\d)(?::?[0-5]\d)?)?$/i;
        if (!time.test(input)) return false;
        if (!/:60/.test(input)) return true;
        const p = input.match(/([0-9.]+|[^0-9.])/g);
        let hm = Number(p[0]) * 60 + Number(p[2]);
        if (p[5] === "+") hm += 24 * 60 - Number(p[6] || 0) * 60 - Number(p[8] || 0);
        else if (p[5] === "-") hm += Number(p[6] || 0) * 60 + Number(p[8] || 0);
        return hm % (24 * 60) === 23 * 60 + 59;
      },
      // first two lines specific to date-time, then tests for unanchored (at end) date, code identical to 'date' above
      // input[17] === '6' is a check for :60
      "date-time": (input) => {
        if (input.length > 10 + 1 + 9 + 12 + 6) return false;
        const full = /^\d\d\d\d-(?:0[1-9]|1[0-2])-(?:[0-2]\d|3[01])[t\s](?:2[0-3]|[0-1]\d):[0-5]\d:(?:[0-5]\d|60)(?:\.\d+)?(?:z|[+-](?:2[0-3]|[0-1]\d)(?::?[0-5]\d)?)$/i;
        const feb = input[5] === "0" && input[6] === "2";
        if (feb && input[8] === "3" || !full.test(input)) return false;
        if (input[17] === "6") {
          const p = input.slice(11).match(/([0-9.]+|[^0-9.])/g);
          let hm = Number(p[0]) * 60 + Number(p[2]);
          if (p[5] === "+") hm += 24 * 60 - Number(p[6] || 0) * 60 - Number(p[8] || 0);
          else if (p[5] === "-") hm += Number(p[6] || 0) * 60 + Number(p[8] || 0);
          if (hm % (24 * 60) !== 23 * 60 + 59) return false;
        }
        if (feb) {
          if (/^\d\d\d\d-02-(?:[012][1-8]|[12]0|[01]9)/.test(input)) return true;
          const matches = input.match(/^(\d\d\d\d)-02-29/);
          if (!matches) return false;
          const year = matches[1] | 0;
          return year % 16 === 0 || year % 4 === 0 && year % 25 !== 0;
        }
        if (input[8] === "3" && input[9] === "1") return /^\d\d\d\d-(?:0[13578]|1[02])-31/.test(input);
        return /^\d\d\d\d-(?:0[13-9]|1[012])-(?:[012][1-9]|[123]0)/.test(input);
      },
      /* ipv4 and ipv6 are from ajv with length restriction */
      // optimized https://www.safaribooksonline.com/library/view/regular-expressions-cookbook/9780596802837/ch07s16.html
      ipv4: (ip) => ip.length <= 15 && /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d\d?)$/.test(ip),
      // optimized http://stackoverflow.com/questions/53497/regular-expression-that-matches-valid-ipv6-addresses
      // max length: 1000:1000:1000:1000:1000:1000:255.255.255.255
      // we parse ip6 format with a simple scan, leaving embedded ipv4 validation to a regex
      // s0=count(:), s1=count(.), hex=count(a-zA-Z0-9), short=count(::)>0
      // 48-57: '0'-'9', 97-102, 65-70: 'a'-'f', 'A'-'F', 58: ':', 46: '.'
      /* eslint-disable one-var */
      // prettier-ignore
      ipv6: (input) => {
        if (input.length > 45 || input.length < 2) return false;
        let s0 = 0, s1 = 0, hex = 0, short = false, letters = false, last = 0, start = true;
        for (let i = 0; i < input.length; i++) {
          const c = input.charCodeAt(i);
          if (i === 1 && last === 58 && c !== 58) return false;
          if (c >= 48 && c <= 57) {
            if (++hex > 4) return false;
          } else if (c === 46) {
            if (s0 > 6 || s1 >= 3 || hex === 0 || letters) return false;
            s1++;
            hex = 0;
          } else if (c === 58) {
            if (s1 > 0 || s0 >= 7) return false;
            if (last === 58) {
              if (short) return false;
              short = true;
            } else if (i === 0) start = false;
            s0++;
            hex = 0;
            letters = false;
          } else if (c >= 97 && c <= 102 || c >= 65 && c <= 70) {
            if (s1 > 0) return false;
            if (++hex > 4) return false;
            letters = true;
          } else return false;
          last = c;
        }
        if (s0 < 2 || s1 > 0 && (s1 !== 3 || hex === 0)) return false;
        if (short && input.length === 2) return true;
        if (s1 > 0 && !/(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/.test(input)) return false;
        const spaces = s1 > 0 ? 6 : 7;
        if (!short) return s0 === spaces && start && hex > 0;
        return (start || hex > 0) && s0 < spaces;
      },
      /* eslint-enable one-var */
      // matches ajv with optimization
      uri: /^[a-z][a-z0-9+\-.]*:(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|v[0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d\d?)|(?:[a-z0-9\-._~!$&'()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*|\/?(?:(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)?)(?:\?(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i,
      // matches ajv with optimization
      "uri-reference": /^(?:[a-z][a-z0-9+\-.]*:)?(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|v[0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d\d?)|(?:[a-z0-9\-._~!$&'()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*|\/?(?:(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)?)?(?:\?(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i,
      // ajv has /^(([^\x00-\x20"'<>%\\^`{|}]|%[0-9a-f]{2})|\{[+#./;?&=,!@|]?([a-z0-9_]|%[0-9a-f]{2})+(:[1-9][0-9]{0,3}|\*)?(,([a-z0-9_]|%[0-9a-f]{2})+(:[1-9][0-9]{0,3}|\*)?)*\})*$/i
      // this is equivalent
      // uri-template: https://tools.ietf.org/html/rfc6570
      // eslint-disable-next-line no-control-regex
      "uri-template": /^(?:[^\x00-\x20"'<>%\\^`{|}]|%[0-9a-f]{2}|\{[+#./;?&=,!@|]?(?:[a-z0-9_]|%[0-9a-f]{2})+(?::[1-9][0-9]{0,3}|\*)?(?:,(?:[a-z0-9_]|%[0-9a-f]{2})+(?::[1-9][0-9]{0,3}|\*)?)*\})*$/i,
      // ajv has /^(\/([^~/]|~0|~1)*)*$/, this is equivalent
      // JSON-pointer: https://tools.ietf.org/html/rfc6901
      "json-pointer": /^(?:|\/(?:[^~]|~0|~1)*)$/,
      // ajv has /^(0|[1-9][0-9]*)(#|(\/([^~/]|~0|~1)*)*)$/, this is equivalent
      // relative JSON-pointer: http://tools.ietf.org/html/draft-luff-relative-json-pointer-00
      "relative-json-pointer": /^(?:0|[1-9][0-9]*)(?:|#|\/(?:[^~]|~0|~1)*)$/,
      // uuid: http://tools.ietf.org/html/rfc4122
      uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      // length restriction is an arbitrary safeguard
      // first regex checks if this a week duration (can't be combined with others)
      // second regex verifies symbols, no more than one fraction, at least 1 block is present, and T is not last
      // third regex verifies structure
      duration: (input) => input.length > 1 && input.length < 80 && (/^P\d+([.,]\d+)?W$/.test(input) || /^P[\dYMDTHS]*(\d[.,]\d+)?[YMDHS]$/.test(input) && /^P([.,\d]+Y)?([.,\d]+M)?([.,\d]+D)?(T([.,\d]+H)?([.,\d]+M)?([.,\d]+S)?)?$/.test(input))
      // TODO: iri, iri-reference, idn-email, idn-hostname
    };
    var extra = {
      // basic
      alpha: /^[a-zA-Z]+$/,
      alphanumeric: /^[a-zA-Z0-9]+$/,
      // hex
      "hex-digits": /^[0-9a-f]+$/i,
      "hex-digits-prefixed": /^0x[0-9a-f]+$/i,
      "hex-bytes": /^([0-9a-f][0-9a-f])+$/i,
      "hex-bytes-prefixed": /^0x([0-9a-f][0-9a-f])+$/i,
      base64: (input) => input.length % 4 === 0 && /^[a-z0-9+/]*={0,3}$/i.test(input),
      // ajv has /^#(\/([a-z0-9_\-.!$&'()*+,;:=@]|%[0-9a-f]{2}|~0|~1)*)*$/i, this is equivalent
      // uri fragment: https://tools.ietf.org/html/rfc3986#appendix-A
      "json-pointer-uri-fragment": /^#(|\/(\/|[a-z0-9_\-.!$&'()*+,;:=@]|%[0-9a-f]{2}|~0|~1)*)$/i,
      // draft3 backwards compat
      "host-name": core.hostname,
      "ip-address": core.ipv4,
      // manually cleaned up from is-my-json-valid, CSS 2.1 colors only per draft03 spec
      color: /^(#[0-9A-Fa-f]{3,6}|aqua|black|blue|fuchsia|gray|green|lime|maroon|navy|olive|orange|purple|red|silver|teal|white|yellow|rgb\(\s*([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\s*,\s*([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\s*,\s*([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\s*\)|rgb\(\s*(\d?\d%|100%)\s*,\s*(\d?\d%|100%)\s*,\s*(\d?\d%|100%)\s*\))$/
      // style is deliberately unsupported, don't accept untrusted styles
    };
    var weak = {
      // In weak because don't accept regexes from untrusted sources, using them can cause DoS
      // matches ajv + length checks
      // eslint comment outside because we don't want comments in functions, those affect output
      /* eslint-disable no-new */
      regex: (str) => {
        if (str.length > 1e5) return false;
        const Z_ANCHOR = /[^\\]\\Z/;
        if (Z_ANCHOR.test(str)) return false;
        try {
          new RegExp(str, "u");
          return true;
        } catch (e) {
          return false;
        }
      }
      /* eslint-enable no-new */
    };
    module.exports = { core, extra, weak };
  }
});

// node_modules/@exodus/schemasafe/src/tracing.js
var require_tracing = __commonJS({
  "node_modules/@exodus/schemasafe/src/tracing.js"(exports, module) {
    "use strict";
    var merge = (a, b) => [.../* @__PURE__ */ new Set([...a, ...b])].sort();
    var intersect = (a, b) => a.filter((x) => b.includes(x));
    var wrapArgs = (f) => (...args) => f(...args.map(normalize));
    var wrapFull = (f) => (...args) => normalize(f(...args.map(normalize)));
    var typeIsNot = (type, t) => type && !type.includes(t);
    var normalize = ({ type = null, dyn: d = {}, ...A }) => ({
      type: type ? [...type].sort() : type,
      items: typeIsNot(type, "array") ? Infinity : A.items || 0,
      properties: typeIsNot(type, "object") ? [true] : [...A.properties || []].sort(),
      patterns: typeIsNot(type, "object") ? [] : [...A.patterns || []].sort(),
      required: typeIsNot(type, "object") ? [] : [...A.required || []].sort(),
      fullstring: typeIsNot(type, "string") || A.fullstring || false,
      dyn: {
        item: typeIsNot(type, "array") ? false : d.item || false,
        items: typeIsNot(type, "array") ? 0 : Math.max(A.items || 0, d.items || 0),
        properties: typeIsNot(type, "object") ? [] : merge(A.properties || [], d.properties || []),
        patterns: typeIsNot(type, "object") ? [] : merge(A.patterns || [], d.patterns || [])
      },
      unknown: A.unknown && !(typeIsNot(type, "object") && typeIsNot(type, "array")) || false
    });
    var initTracing = () => normalize({});
    var andDelta = wrapFull((A, B) => ({
      type: A.type && B.type ? intersect(A.type, B.type) : A.type || B.type || null,
      items: Math.max(A.items, B.items),
      properties: merge(A.properties, B.properties),
      patterns: merge(A.patterns, B.patterns),
      required: merge(A.required, B.required),
      fullstring: A.fullstring || B.fullstring,
      dyn: {
        item: A.dyn.item || B.dyn.item,
        items: Math.max(A.dyn.items, B.dyn.items),
        properties: merge(A.dyn.properties, B.dyn.properties),
        patterns: merge(A.dyn.patterns, B.dyn.patterns)
      },
      unknown: A.unknown || B.unknown
    }));
    var regtest = (pattern, value) => value !== true && new RegExp(pattern, "u").test(value);
    var intersectProps = ({ properties: a, patterns: rega }, { properties: b, patterns: regb }) => {
      const af = a.filter((x) => b.includes(x) || b.includes(true) || regb.some((p) => regtest(p, x)));
      const bf = b.filter((x) => a.includes(x) || a.includes(true) || rega.some((p) => regtest(p, x)));
      const ar = rega.filter((x) => regb.includes(x) || b.includes(true));
      const br = regb.filter((x) => rega.includes(x) || a.includes(true));
      return { properties: merge(af, bf), patterns: merge(ar, br) };
    };
    var inProperties = ({ properties: a, patterns: rega }, { properties: b, patterns: regb }) => b.every((x) => a.includes(x) || a.includes(true) || rega.some((p) => regtest(p, x))) && regb.every((x) => rega.includes(x) || a.includes(true));
    var orDelta = wrapFull((A, B) => ({
      type: A.type && B.type ? merge(A.type, B.type) : null,
      items: Math.min(A.items, B.items),
      ...intersectProps(A, B),
      required: typeIsNot(A.type, "object") && B.required || typeIsNot(B.type, "object") && A.required || intersect(A.required, B.required),
      fullstring: A.fullstring && B.fullstring,
      dyn: {
        item: A.dyn.item || B.dyn.item,
        items: Math.max(A.dyn.items, B.dyn.items),
        properties: merge(A.dyn.properties, B.dyn.properties),
        patterns: merge(A.dyn.patterns, B.dyn.patterns)
      },
      unknown: A.unknown || B.unknown
    }));
    var applyDelta = (stat, delta) => Object.assign(stat, andDelta(stat, delta));
    var isDynamic = wrapArgs(({ unknown, items, dyn, ...stat }) => ({
      items: items !== Infinity && (unknown || dyn.items > items || dyn.item),
      properties: !stat.properties.includes(true) && (unknown || !inProperties(stat, dyn))
    }));
    module.exports = { initTracing, andDelta, orDelta, applyDelta, isDynamic, inProperties };
  }
});

// node_modules/@exodus/schemasafe/src/compile.js
var require_compile = __commonJS({
  "node_modules/@exodus/schemasafe/src/compile.js"(exports, module) {
    "use strict";
    var { format, safe, safeand, safenot, safenotor } = require_safe_format();
    var genfun = require_generate_function();
    var { resolveReference, joinPath, getDynamicAnchors, hasKeywords } = require_pointer();
    var formats = require_formats();
    var { toPointer, ...functions } = require_scope_functions();
    var { scopeMethods } = require_scope_utils();
    var { buildName, types, jsHelpers } = require_javascript();
    var { knownKeywords, schemaVersions, knownVocabularies } = require_known_keywords();
    var { initTracing, andDelta, orDelta, applyDelta, isDynamic, inProperties } = require_tracing();
    var noopRegExps = /* @__PURE__ */ new Set(["^[\\s\\S]*$", "^[\\S\\s]*$", "^[^]*$", "", ".*", "^", "$"]);
    var primitiveTypes = ["null", "boolean", "number", "integer", "string"];
    var schemaTypes = new Map(
      Object.entries({
        boolean: (arg) => typeof arg === "boolean",
        array: (arg) => Array.isArray(arg) && Object.getPrototypeOf(arg) === Array.prototype,
        object: (arg) => arg && Object.getPrototypeOf(arg) === Object.prototype,
        finite: (arg) => Number.isFinite(arg),
        natural: (arg) => Number.isInteger(arg) && arg >= 0,
        string: (arg) => typeof arg === "string",
        jsonval: (arg) => functions.deepEqual(arg, JSON.parse(JSON.stringify(arg)))
      })
    );
    var isPlainObject = schemaTypes.get("object");
    var isSchemaish = (arg) => isPlainObject(arg) || typeof arg === "boolean";
    var deltaEmpty = (delta) => functions.deepEqual(delta, { type: [] });
    var schemaIsOlderThan = ($schema, ver) => schemaVersions.indexOf($schema) > schemaVersions.indexOf(`https://json-schema.org/${ver}/schema`);
    var schemaIsUnkownOrOlder = ($schema, ver) => {
      const normalized = `${$schema}`.replace(/^http:\/\//, "https://").replace(/#$/, "");
      if (!schemaVersions.includes(normalized)) return true;
      return schemaIsOlderThan(normalized, ver);
    };
    var propvar = (parent, keyname, inKeys = false, number = false) => Object.freeze({ parent, keyname, inKeys, number });
    var propimm = (parent, keyval, checked = false) => Object.freeze({ parent, keyval, checked });
    var evaluatedStatic = Symbol("evaluatedStatic");
    var optDynamic = Symbol("optDynamic");
    var optDynAnchors = Symbol("optDynAnchors");
    var optRecAnchors = Symbol("optRecAnchors");
    var constantValue = (schema) => {
      if (typeof schema === "boolean") return schema;
      if (isPlainObject(schema) && Object.keys(schema).length === 0) return true;
      return void 0;
    };
    var refsNeedFullValidation = /* @__PURE__ */ new Set();
    var rootMeta = /* @__PURE__ */ new Map();
    var generateMeta = (root, $schema, enforce, requireSchema) => {
      if ($schema) {
        const version = $schema.replace(/^http:\/\//, "https://").replace(/#$/, "");
        enforce(schemaVersions.includes(version), "Unexpected schema version:", version);
        rootMeta.set(root, {
          exclusiveRefs: schemaIsOlderThan(version, "draft/2019-09"),
          contentValidation: schemaIsOlderThan(version, "draft/2019-09"),
          dependentUnsupported: schemaIsOlderThan(version, "draft/2019-09"),
          newItemsSyntax: !schemaIsOlderThan(version, "draft/2020-12"),
          containsEvaluates: !schemaIsOlderThan(version, "draft/2020-12"),
          objectContains: !schemaIsOlderThan(version, "draft/next"),
          bookending: schemaIsOlderThan(version, "draft/next")
        });
      } else {
        enforce(!requireSchema, "[requireSchema] $schema is required");
        rootMeta.set(root, {});
      }
    };
    var compileSchema = (schema, root, opts, scope, basePathRoot = "") => {
      const {
        mode = "default",
        useDefaults = false,
        removeAdditional = false,
        // supports additionalProperties: false and additionalItems: false
        includeErrors = false,
        allErrors = false,
        contentValidation,
        dryRun,
        // unused, just for rest siblings
        lint: lintOnly = false,
        allowUnusedKeywords = opts.mode === "lax" || opts.mode === "spec",
        allowUnreachable = opts.mode === "lax" || opts.mode === "spec",
        requireSchema = opts.mode === "strong",
        requireValidation = opts.mode === "strong",
        requireStringValidation = opts.mode === "strong",
        forbidNoopValues = opts.mode === "strong",
        // e.g. $recursiveAnchor: false (it's false by default)
        complexityChecks = opts.mode === "strong",
        unmodifiedPrototypes = false,
        // assumes no mangled Object/Array prototypes
        isJSON = false,
        // assume input to be JSON, which e.g. makes undefined impossible
        $schemaDefault = null,
        formatAssertion = opts.mode !== "spec" || schemaIsUnkownOrOlder(root.$schema, "draft/2019-09"),
        formats: optFormats = {},
        weakFormats = opts.mode !== "strong",
        extraFormats = false,
        schemas,
        // always a Map, produced at wrapper
        ...unknown
      } = opts;
      const fmts = {
        ...formats.core,
        ...weakFormats ? formats.weak : {},
        ...extraFormats ? formats.extra : {},
        ...optFormats
      };
      if (Object.keys(unknown).length !== 0)
        throw new Error(`Unknown options: ${Object.keys(unknown).join(", ")}`);
      if (!["strong", "lax", "default", "spec"].includes(mode)) throw new Error(`Invalid mode: ${mode}`);
      if (!includeErrors && allErrors) throw new Error("allErrors requires includeErrors to be enabled");
      if (requireSchema && $schemaDefault) throw new Error("requireSchema forbids $schemaDefault");
      if (mode === "strong") {
        const validation = { requireValidation, requireStringValidation };
        const strong = { ...validation, formatAssertion, complexityChecks, requireSchema };
        const weak = { weakFormats, allowUnusedKeywords };
        for (const [k, v] of Object.entries(strong)) if (!v) throw new Error(`Strong mode demands ${k}`);
        for (const [k, v] of Object.entries(weak)) if (v) throw new Error(`Strong mode forbids ${k}`);
      }
      const { gensym, getref, genref, genformat } = scopeMethods(scope);
      const buildPath = (prop) => {
        const path = [];
        let curr = prop;
        while (curr) {
          if (!curr.name) path.unshift(curr);
          curr = curr.parent || curr.errorParent;
        }
        if (path.every((part) => part.keyval !== void 0))
          return format("%j", toPointer(path.map((part) => part.keyval)));
        const stringParts = ["#"];
        const stringJoined = () => {
          const value = stringParts.map(functions.pointerPart).join("/");
          stringParts.length = 0;
          return value;
        };
        let res = null;
        for (const { keyname, keyval, number } of path) {
          if (keyname) {
            if (!number) scope.pointerPart = functions.pointerPart;
            const value = number ? keyname : format("pointerPart(%s)", keyname);
            const str = `${stringJoined()}/`;
            res = res ? format("%s+%j+%s", res, str, value) : format("%j+%s", str, value);
          } else if (keyval) stringParts.push(keyval);
        }
        return stringParts.length > 0 ? format("%s+%j", res, `/${stringJoined()}`) : res;
      };
      const funname = genref(schema);
      let validate = null;
      const wrap = (...args) => {
        const res = validate(...args);
        wrap.errors = validate.errors;
        return res;
      };
      scope[funname] = wrap;
      const hasRefs = hasKeywords(schema, ["$ref", "$recursiveRef", "$dynamicRef"]);
      const hasDynAnchors = opts[optDynAnchors] && hasRefs && hasKeywords(schema, ["$dynamicAnchor"]);
      const dynAnchorsHead = () => {
        if (!opts[optDynAnchors]) return format("");
        return hasDynAnchors ? format(", dynAnchors = []") : format(", dynAnchors");
      };
      const recAnchorsHead = opts[optRecAnchors] ? format(", recursive") : format("");
      const fun = genfun();
      fun.write("function validate(data%s%s) {", recAnchorsHead, dynAnchorsHead());
      if (includeErrors) fun.write("validate.errors = null");
      if (allErrors) fun.write("let errorCount = 0");
      if (opts[optDynamic]) fun.write("validate.evaluatedDynamic = null");
      let dynamicAnchorsNext = opts[optDynAnchors] ? format(", dynAnchors") : format("");
      if (hasDynAnchors) {
        fun.write("const dynLocal = [{}]");
        dynamicAnchorsNext = format(", [...dynAnchors, dynLocal[0] || []]");
      }
      const helpers = jsHelpers(fun, scope, propvar, { unmodifiedPrototypes, isJSON }, noopRegExps);
      const { present, forObjectKeys, forArray, patternTest, compare } = helpers;
      const recursiveLog = [];
      const getMeta = () => rootMeta.get(root);
      const basePathStack = basePathRoot ? [basePathRoot] : [];
      const visit = (errors, history, current, node, schemaPath, trace = {}, { constProp } = {}) => {
        const isSub = history.length > 0 && history[history.length - 1].prop === current;
        const queryCurrent = () => history.filter((h) => h.prop === current);
        const definitelyPresent = !current.parent || current.checked || current.inKeys && isJSON || queryCurrent().length > 0;
        const name = buildName(current);
        const currPropImm = (...args) => propimm(current, ...args);
        const error = ({ path = [], prop = current, source, suberr }) => {
          const schemaP = toPointer([...schemaPath, ...path]);
          const dataP = includeErrors ? buildPath(prop) : null;
          if (includeErrors === true && errors && source) {
            scope.errorMerge = functions.errorMerge;
            const args = [source, schemaP, dataP];
            if (allErrors) {
              fun.write("if (validate.errors === null) validate.errors = []");
              fun.write("validate.errors.push(...%s.map(e => errorMerge(e, %j, %s)))", ...args);
            } else fun.write("validate.errors = [errorMerge(%s[0], %j, %s)]", ...args);
          } else if (includeErrors === true && errors) {
            const errorJS = format("{ keywordLocation: %j, instanceLocation: %s }", schemaP, dataP);
            if (allErrors) {
              fun.write("if (%s === null) %s = []", errors, errors);
              fun.write("%s.push(%s)", errors, errorJS);
            } else fun.write("%s = [%s]", errors, errorJS);
          }
          if (suberr) mergeerror(suberr);
          if (allErrors) fun.write("errorCount++");
          else fun.write("return false");
        };
        const errorIf = (condition, errorArgs) => fun.if(condition, () => error(errorArgs));
        if (lintOnly && !scope.lintErrors) scope.lintErrors = [];
        const fail = (msg, value) => {
          const comment = value !== void 0 ? ` ${JSON.stringify(value)}` : "";
          const keywordLocation = joinPath(basePathRoot, toPointer(schemaPath));
          const message = `${msg}${comment} at ${keywordLocation}`;
          if (lintOnly) return scope.lintErrors.push({ message, keywordLocation, schema });
          throw new Error(message);
        };
        const patternTestSafe = (pat, key) => {
          try {
            return patternTest(pat, key);
          } catch (e) {
            fail(e.message);
            return format("false");
          }
        };
        const enforce = (ok, ...args) => ok || fail(...args);
        const laxMode = (ok, ...args) => enforce(mode === "lax" || mode === "spec" || ok, ...args);
        const enforceMinMax = (a, b) => laxMode(!(node[b] < node[a]), `Invalid ${a} / ${b} combination`);
        const enforceValidation = (msg, suffix = "should be specified") => enforce(!requireValidation, `[requireValidation] ${msg} ${suffix}`);
        const subPath = (...args) => [...schemaPath, ...args];
        const uncertain = (msg) => enforce(!removeAdditional && !useDefaults, `[removeAdditional/useDefaults] uncertain: ${msg}`);
        const complex = (msg, arg) => enforce(!complexityChecks, `[complexityChecks] ${msg}`, arg);
        const saveMeta = ($sch) => generateMeta(root, $sch || $schemaDefault, enforce, requireSchema);
        const stat2 = initTracing();
        const evaluateDelta = (delta) => applyDelta(stat2, delta);
        if (typeof node === "boolean") {
          if (node === true) {
            enforceValidation("schema = true", "is not allowed");
            return { stat: stat2 };
          }
          errorIf(definitelyPresent || current.inKeys ? true : present(current), {});
          evaluateDelta({ type: [] });
          return { stat: stat2 };
        }
        enforce(isPlainObject(node), "Schema is not an object");
        for (const key of Object.keys(node))
          enforce(knownKeywords.includes(key) || allowUnusedKeywords, "Keyword not supported:", key);
        if (Object.keys(node).length === 0) {
          enforceValidation("empty rules node", "is not allowed");
          return { stat: stat2 };
        }
        const unused = new Set(Object.keys(node));
        const multiConsumable = /* @__PURE__ */ new Set();
        const consume = (prop, ...ruleTypes) => {
          enforce(multiConsumable.has(prop) || unused.has(prop), "Unexpected double consumption:", prop);
          enforce(functions.hasOwn(node, prop), "Is not an own property:", prop);
          enforce(ruleTypes.every((t) => schemaTypes.has(t)), "Invalid type used in consume");
          enforce(ruleTypes.some((t) => schemaTypes.get(t)(node[prop])), "Unexpected type for", prop);
          unused.delete(prop);
        };
        const get = (prop, ...ruleTypes) => {
          if (node[prop] !== void 0) consume(prop, ...ruleTypes);
          return node[prop];
        };
        const handle = (prop, ruleTypes, handler, errorArgs = {}) => {
          if (node[prop] === void 0) return false;
          consume(prop, ...ruleTypes);
          if (handler !== null) {
            try {
              const condition = handler(node[prop]);
              if (condition !== null) errorIf(condition, { path: [prop], ...errorArgs });
            } catch (e) {
              if (lintOnly && !e.message.startsWith("[opt] ")) {
                fail(e.message);
              } else {
                throw e;
              }
            }
          }
          return true;
        };
        if (node === root) {
          saveMeta(get("$schema", "string"));
          handle("$vocabulary", ["object"], ($vocabulary) => {
            for (const [vocab, flag] of Object.entries($vocabulary)) {
              if (flag === false) continue;
              enforce(flag === true && knownVocabularies.includes(vocab), "Unknown vocabulary:", vocab);
            }
            return null;
          });
        } else if (!getMeta()) saveMeta(root.$schema);
        if (getMeta().objectContains) {
          for (const prop of ["contains", "minContains", "maxContains"]) multiConsumable.add(prop);
        }
        handle("examples", ["array"], null);
        handle("example", ["jsonval"], null);
        for (const ignore of ["title", "description", "$comment"]) handle(ignore, ["string"], null);
        for (const ignore of ["deprecated", "readOnly", "writeOnly"]) handle(ignore, ["boolean"], null);
        handle("$defs", ["object"], null) || handle("definitions", ["object"], null);
        const compileSub = (sub, subR, path) => sub === schema ? safe("validate") : getref(sub) || compileSchema(sub, subR, opts, scope, path);
        const basePath = () => basePathStack.length > 0 ? basePathStack[basePathStack.length - 1] : "";
        const basePathStackLength = basePathStack.length;
        const setId = ($id) => {
          basePathStack.push(joinPath(basePath(), $id));
          return null;
        };
        if (!getMeta().exclusiveRefs || !node.$ref) {
          handle("$id", ["string"], setId) || handle("id", ["string"], setId);
          handle("$anchor", ["string"], null);
          handle("$dynamicAnchor", ["string"], null);
          if (node.$recursiveAnchor || !forbidNoopValues) {
            handle("$recursiveAnchor", ["boolean"], (isRecursive) => {
              if (isRecursive) recursiveLog.push([node, root, basePath()]);
              return null;
            });
          }
        }
        const isDynScope = hasDynAnchors && (node === schema || node.id || node.$id);
        if (isDynScope) {
          const allDynamic = getDynamicAnchors(node);
          if (node !== schema) fun.write("dynLocal.unshift({})");
          for (const [key, subcheck] of allDynamic) {
            const resolved = resolveReference(root, schemas, `#${key}`, basePath());
            const [sub, subRoot, path] = resolved[0] || [];
            enforce(sub === subcheck, `Unexpected $dynamicAnchor resolution: ${key}`);
            const n = compileSub(sub, subRoot, path);
            fun.write("dynLocal[0][%j] = %s", `#${key}`, n);
          }
        }
        const needUnevaluated = (rule2) => opts[optDynamic] && (node[rule2] || node[rule2] === false || node === schema);
        const local2 = Object.freeze({
          item: needUnevaluated("unevaluatedItems") ? gensym("evaluatedItem") : null,
          items: needUnevaluated("unevaluatedItems") ? gensym("evaluatedItems") : null,
          props: needUnevaluated("unevaluatedProperties") ? gensym("evaluatedProps") : null
        });
        const dyn = Object.freeze({
          item: local2.item || trace.item,
          items: local2.items || trace.items,
          props: local2.props || trace.props
        });
        const canSkipDynamic = () => (!dyn.items || stat2.items === Infinity) && (!dyn.props || stat2.properties.includes(true));
        const evaluateDeltaDynamic = (delta) => {
          if (dyn.item && delta.item && stat2.items !== Infinity)
            fun.write("%s.push(%s)", dyn.item, delta.item);
          if (dyn.items && delta.items > stat2.items) fun.write("%s.push(%d)", dyn.items, delta.items);
          if (dyn.props && (delta.properties || []).includes(true) && !stat2.properties.includes(true)) {
            fun.write("%s[0].push(true)", dyn.props);
          } else if (dyn.props) {
            const inStat = (properties2, patterns2) => inProperties(stat2, { properties: properties2, patterns: patterns2 });
            const properties = (delta.properties || []).filter((x) => !inStat([x], []));
            const patterns = (delta.patterns || []).filter((x) => !inStat([], [x]));
            if (properties.length > 0) fun.write("%s[0].push(...%j)", dyn.props, properties);
            if (patterns.length > 0) fun.write("%s[1].push(...%j)", dyn.props, patterns);
            for (const sym of delta.propertiesVars || []) fun.write("%s[0].push(%s)", dyn.props, sym);
          }
        };
        const applyDynamicToDynamic = (target, item, items, props) => {
          if (isDynamic(stat2).items && target.item && item)
            fun.write("%s.push(...%s)", target.item, item);
          if (isDynamic(stat2).items && target.items && items)
            fun.write("%s.push(...%s)", target.items, items);
          if (isDynamic(stat2).properties && target.props && props) {
            fun.write("%s[0].push(...%s[0])", target.props, props);
            fun.write("%s[1].push(...%s[1])", target.props, props);
          }
        };
        const makeRecursive = () => {
          if (!opts[optRecAnchors]) return format("");
          if (recursiveLog.length === 0) return format(", recursive");
          return format(", recursive || %s", compileSub(...recursiveLog[0]));
        };
        const applyRef = (n, errorArgs) => {
          const delta = scope[n] && scope[n][evaluatedStatic] || { unknown: true };
          evaluateDelta(delta);
          const call = format("%s(%s%s%s)", n, name, makeRecursive(), dynamicAnchorsNext);
          if (!includeErrors && canSkipDynamic()) return format("!%s", call);
          const res = gensym("res");
          const err = gensym("err");
          const suberr = gensym("suberr");
          if (includeErrors) fun.write("const %s = validate.errors", err);
          fun.write("const %s = %s", res, call);
          if (includeErrors) fun.write("const %s = %s.errors", suberr, n);
          if (includeErrors) fun.write("validate.errors = %s", err);
          errorIf(safenot(res), { ...errorArgs, source: suberr });
          fun.if(res, () => {
            const item = isDynamic(delta).items ? format("%s.evaluatedDynamic[0]", n) : null;
            const items = isDynamic(delta).items ? format("%s.evaluatedDynamic[1]", n) : null;
            const props = isDynamic(delta).properties ? format("%s.evaluatedDynamic[2]", n) : null;
            applyDynamicToDynamic(dyn, item, items, props);
          });
          return null;
        };
        const allIn = (arr, valid) => arr && arr.every((s) => valid.includes(s));
        const someIn = (arr, possible) => possible.some((x) => arr === null || arr.includes(x));
        const parentCheckedType = (...valid) => queryCurrent().some((h) => allIn(h.stat.type, valid));
        const definitelyType = (...valid) => allIn(stat2.type, valid) || parentCheckedType(...valid);
        const typeApplicable = (...possible) => someIn(stat2.type, possible) && queryCurrent().every((h) => someIn(h.stat.type, possible));
        const enforceRegex = (source, target = node) => {
          enforce(typeof source === "string", "Invalid pattern:", source);
          if (requireValidation || requireStringValidation)
            enforce(/^\^.*\$$/.test(source), "Should start with ^ and end with $:", source);
          if (/([{+*].*[{+*]|\)[{+*]|^[^^].*[{+*].)/.test(source) && target.maxLength === void 0)
            complex("maxLength should be specified for pattern:", source);
        };
        const havePattern = node.pattern && !noopRegExps.has(node.pattern);
        const haveComplex = node.uniqueItems || havePattern || node.patternProperties || node.format;
        const prev = allErrors && haveComplex ? gensym("prev") : null;
        const prevWrap = (shouldWrap, writeBody) => fun.if(shouldWrap && prev !== null ? format("errorCount === %s", prev) : true, writeBody);
        const nexthistory = () => [...history, { stat: stat2, prop: current }];
        const rule = (...args) => visit(errors, nexthistory(), ...args).stat;
        const subrule = (suberr, ...args) => {
          if (args[0] === current) {
            const constval = constantValue(args[1]);
            if (constval === true) return { sub: format("true"), delta: {} };
            if (constval === false) return { sub: format("false"), delta: { type: [] } };
          }
          const sub = gensym("sub");
          fun.write("const %s = (() => {", sub);
          if (allErrors) fun.write("let errorCount = 0");
          const { stat: delta } = visit(suberr, nexthistory(), ...args);
          if (allErrors) {
            fun.write("return errorCount === 0");
          } else fun.write("return true");
          fun.write("})()");
          return { sub, delta };
        };
        const suberror = () => {
          const suberr = includeErrors && allErrors ? gensym("suberr") : null;
          if (suberr) fun.write("let %s = null", suberr);
          return suberr;
        };
        const mergeerror = (suberr) => {
          if (errors === null || suberr === null) return;
          fun.if(suberr, () => fun.write("%s.push(...%s)", errors, suberr));
        };
        const willRemoveAdditional = () => {
          if (!removeAdditional) return false;
          if (removeAdditional === true) return true;
          if (removeAdditional === "keyword") {
            if (!node.removeAdditional) return false;
            consume("removeAdditional", "boolean");
            return true;
          }
          throw new Error(`Invalid removeAdditional: ${removeAdditional}`);
        };
        const additionalItems = (rulePath, limit, extra) => {
          const handled = handle(rulePath, ["object", "boolean"], (ruleValue) => {
            if (ruleValue === false && willRemoveAdditional()) {
              fun.write("if (%s.length > %s) %s.length = %s", name, limit, name, limit);
              return null;
            }
            if (ruleValue === false && !extra) return format("%s.length > %s", name, limit);
            forArray(current, limit, (prop, i) => {
              if (extra) fun.write("if (%s) continue", extra(i));
              return rule(prop, ruleValue, subPath(rulePath));
            });
            return null;
          });
          if (handled) evaluateDelta({ items: Infinity });
        };
        const additionalProperties = (rulePath, condition) => {
          const handled = handle(rulePath, ["object", "boolean"], (ruleValue) => {
            forObjectKeys(current, (sub, key) => {
              fun.if(condition(key), () => {
                if (ruleValue === false && willRemoveAdditional()) fun.write("delete %s[%s]", name, key);
                else rule(sub, ruleValue, subPath(rulePath));
              });
            });
            return null;
          });
          if (handled) evaluateDelta({ properties: [true] });
        };
        const additionalCondition = (key, properties, patternProperties) => safeand(
          ...properties.map((p) => format("%s !== %j", key, p)),
          ...patternProperties.map((p) => safenot(patternTestSafe(p, key)))
        );
        const lintRequired = (properties, patterns) => {
          const regexps = patterns.map((p) => new RegExp(p, "u"));
          const known = (key) => properties.includes(key) || regexps.some((r) => r.test(key));
          for (const key of stat2.required) enforce(known(key), `Unknown required property:`, key);
        };
        const finalLint = [];
        const checkNumbers = () => {
          const minMax = (value, operator) => format("!(%d %c %s)", value, operator, name);
          if (Number.isFinite(node.exclusiveMinimum)) {
            handle("exclusiveMinimum", ["finite"], (min) => minMax(min, "<"));
          } else {
            handle("minimum", ["finite"], (min) => minMax(min, node.exclusiveMinimum ? "<" : "<="));
            handle("exclusiveMinimum", ["boolean"], null);
          }
          if (Number.isFinite(node.exclusiveMaximum)) {
            handle("exclusiveMaximum", ["finite"], (max) => minMax(max, ">"));
            enforceMinMax("minimum", "exclusiveMaximum");
            enforceMinMax("exclusiveMinimum", "exclusiveMaximum");
          } else if (node.maximum !== void 0) {
            handle("maximum", ["finite"], (max) => minMax(max, node.exclusiveMaximum ? ">" : ">="));
            handle("exclusiveMaximum", ["boolean"], null);
            enforceMinMax("minimum", "maximum");
            enforceMinMax("exclusiveMinimum", "maximum");
          }
          const multipleOf = node.multipleOf === void 0 ? "divisibleBy" : "multipleOf";
          handle(multipleOf, ["finite"], (value) => {
            enforce(value > 0, `Invalid ${multipleOf}:`, value);
            const [part, exp] = `${value}`.split("e-");
            const frac = `${part}.`.split(".")[1];
            const e = frac.length + (exp ? Number(exp) : 0);
            if (Number.isInteger(value * 2 ** e)) return format("%s %% %d !== 0", name, value);
            scope.isMultipleOf = functions.isMultipleOf;
            const args = [name, value, e, Math.round(value * Math.pow(10, e))];
            return format("!isMultipleOf(%s, %d, 1e%d, %d)", ...args);
          });
        };
        const checkStrings = () => {
          handle("maxLength", ["natural"], (max) => {
            scope.stringLength = functions.stringLength;
            return format("%s.length > %d && stringLength(%s) > %d", name, max, name, max);
          });
          handle("minLength", ["natural"], (min) => {
            scope.stringLength = functions.stringLength;
            return format("%s.length < %d || stringLength(%s) < %d", name, min, name, min);
          });
          enforceMinMax("minLength", "maxLength");
          prevWrap(true, () => {
            const checkFormat = (fmtname, target, formatsObj = fmts) => {
              const known = typeof fmtname === "string" && functions.hasOwn(formatsObj, fmtname);
              enforce(known, "Unrecognized format used:", fmtname);
              const formatImpl = formatsObj[fmtname];
              const valid = formatImpl instanceof RegExp || typeof formatImpl === "function";
              enforce(valid, "Invalid format used:", fmtname);
              if (!formatAssertion) return null;
              if (formatImpl instanceof RegExp) {
                if (functions.hasOwn(optFormats, fmtname)) enforceRegex(formatImpl.source);
                return format("!%s.test(%s)", genformat(formatImpl), target);
              }
              return format("!%s(%s)", genformat(formatImpl), target);
            };
            handle("format", ["string"], (value) => {
              evaluateDelta({ fullstring: true });
              return checkFormat(value, name);
            });
            handle("pattern", ["string"], (pattern) => {
              enforceRegex(pattern);
              evaluateDelta({ fullstring: true });
              return noopRegExps.has(pattern) ? null : safenot(patternTestSafe(pattern, name));
            });
            enforce(node.contentSchema !== false, "contentSchema cannot be set to false");
            const cV = contentValidation === void 0 ? getMeta().contentValidation : contentValidation;
            const haveContent = node.contentEncoding || node.contentMediaType || node.contentSchema;
            const contentErr = '"content*" keywords are disabled by default per spec, enable with { contentValidation = true } option (see doc/Options.md for more info)';
            enforce(!haveContent || cV || allowUnusedKeywords, contentErr);
            if (haveContent && cV) {
              const dec = gensym("dec");
              if (node.contentMediaType) fun.write("let %s = %s", dec, name);
              if (node.contentEncoding === "base64") {
                errorIf(checkFormat("base64", name, formats.extra), { path: ["contentEncoding"] });
                if (node.contentMediaType) {
                  scope.deBase64 = functions.deBase64;
                  fun.write("try {");
                  fun.write("%s = deBase64(%s)", dec, dec);
                }
                consume("contentEncoding", "string");
              } else enforce(!node.contentEncoding, "Unknown contentEncoding:", node.contentEncoding);
              let json = false;
              if (node.contentMediaType === "application/json") {
                fun.write("try {");
                fun.write("%s = JSON.parse(%s)", dec, dec);
                json = true;
                consume("contentMediaType", "string");
              } else enforce(!node.contentMediaType, "Unknown contentMediaType:", node.contentMediaType);
              if (node.contentSchema) {
                enforce(json, "contentSchema requires contentMediaType application/json");
                const decprop = Object.freeze({ name: dec, errorParent: current });
                rule(decprop, node.contentSchema, subPath("contentSchema"));
                consume("contentSchema", "object", "array");
                evaluateDelta({ fullstring: true });
              }
              if (node.contentMediaType) {
                fun.write("} catch (e) {");
                error({ path: ["contentMediaType"] });
                fun.write("}");
                if (node.contentEncoding) {
                  fun.write("} catch (e) {");
                  error({ path: ["contentEncoding"] });
                  fun.write("}");
                }
              }
            }
          });
        };
        const checkArrays = () => {
          handle("maxItems", ["natural"], (max) => {
            const prefixItemsName = getMeta().newItemsSyntax ? "prefixItems" : "items";
            if (Array.isArray(node[prefixItemsName]) && node[prefixItemsName].length > max)
              fail(`Invalid maxItems: ${max} is less than ${prefixItemsName} array length`);
            return format("%s.length > %d", name, max);
          });
          handle("minItems", ["natural"], (min) => format("%s.length < %d", name, min));
          enforceMinMax("minItems", "maxItems");
          const checkItemsArray = (items) => {
            for (let p = 0; p < items.length; p++) rule(currPropImm(p), items[p], subPath(`${p}`));
            evaluateDelta({ items: items.length });
            return null;
          };
          if (getMeta().newItemsSyntax) {
            handle("prefixItems", ["array"], checkItemsArray);
            additionalItems("items", format("%d", (node.prefixItems || []).length));
          } else if (Array.isArray(node.items)) {
            handle("items", ["array"], checkItemsArray);
            additionalItems("additionalItems", format("%d", node.items.length));
          } else {
            handle("items", ["object", "boolean"], (items) => {
              forArray(current, format("0"), (prop) => rule(prop, items, subPath("items")));
              evaluateDelta({ items: Infinity });
              return null;
            });
          }
          checkContains((run) => {
            forArray(current, format("0"), (prop, i) => {
              run(prop, () => {
                evaluateDelta({ dyn: { item: true } });
                evaluateDeltaDynamic({ item: i });
              });
            });
          });
          const itemsSimple = (ischema) => {
            if (!isPlainObject(ischema)) return false;
            if (ischema.enum || functions.hasOwn(ischema, "const")) return true;
            if (ischema.type) {
              const itemTypes = Array.isArray(ischema.type) ? ischema.type : [ischema.type];
              if (itemTypes.every((itemType) => primitiveTypes.includes(itemType))) return true;
            }
            if (ischema.$ref) {
              const [sub] = resolveReference(root, schemas, ischema.$ref, basePath())[0] || [];
              if (itemsSimple(sub)) return true;
            }
            return false;
          };
          const itemsSimpleOrFalse = (ischema) => ischema === false || itemsSimple(ischema);
          const uniqueSimple = () => {
            if (node.maxItems !== void 0 || itemsSimpleOrFalse(node.items)) return true;
            if (Array.isArray(node.items) && itemsSimpleOrFalse(node.additionalItems)) return true;
            return false;
          };
          prevWrap(true, () => {
            handle("uniqueItems", ["boolean"], (uniqueItems) => {
              if (uniqueItems === false) return null;
              if (!uniqueSimple()) complex("maxItems should be specified for non-primitive uniqueItems");
              Object.assign(scope, { unique: functions.unique, deepEqual: functions.deepEqual });
              return format("!unique(%s)", name);
            });
          });
        };
        const checked = (p) => !allErrors && (stat2.required.includes(p) || queryCurrent().some((h) => h.stat.required.includes(p)));
        const checkObjects = () => {
          const propertiesCount = format("Object.keys(%s).length", name);
          handle("maxProperties", ["natural"], (max) => format("%s > %d", propertiesCount, max));
          handle("minProperties", ["natural"], (min) => format("%s < %d", propertiesCount, min));
          enforceMinMax("minProperties", "maxProperties");
          handle("propertyNames", ["object", "boolean"], (s) => {
            forObjectKeys(current, (sub, key) => {
              const nameSchema = typeof s === "object" && !s.$ref ? { type: "string", ...s } : s;
              const nameprop = Object.freeze({ name: key, errorParent: sub, type: "string" });
              rule(nameprop, nameSchema, subPath("propertyNames"));
            });
            return null;
          });
          handle("required", ["array"], (required) => {
            for (const req of required) {
              if (checked(req)) continue;
              const prop = currPropImm(req);
              errorIf(safenot(present(prop)), { path: ["required"], prop });
            }
            evaluateDelta({ required });
            return null;
          });
          for (const dependencies of ["dependencies", "dependentRequired", "dependentSchemas"]) {
            if (dependencies !== "dependencies" && getMeta().dependentUnsupported) continue;
            handle(dependencies, ["object"], (value) => {
              for (const key of Object.keys(value)) {
                const deps = typeof value[key] === "string" ? [value[key]] : value[key];
                const item = currPropImm(key, checked(key));
                if (Array.isArray(deps) && dependencies !== "dependentSchemas") {
                  const clauses = deps.filter((k) => !checked(k)).map((k) => present(currPropImm(k)));
                  const condition = safenot(safeand(...clauses));
                  const errorArgs = { path: [dependencies, key] };
                  if (clauses.length === 0) {
                  } else if (item.checked) {
                    errorIf(condition, errorArgs);
                    evaluateDelta({ required: deps });
                  } else {
                    errorIf(safeand(present(item), condition), errorArgs);
                  }
                } else if (isSchemaish(deps) && dependencies !== "dependentRequired") {
                  uncertain(dependencies);
                  fun.if(item.checked ? true : present(item), () => {
                    const delta = rule(current, deps, subPath(dependencies, key), dyn);
                    evaluateDelta(orDelta({}, delta));
                    evaluateDeltaDynamic(delta);
                  });
                } else fail(`Unexpected ${dependencies} entry`);
              }
              return null;
            });
          }
          handle("propertyDependencies", ["object"], (propertyDependencies) => {
            for (const [key, variants] of Object.entries(propertyDependencies)) {
              enforce(isPlainObject(variants), "propertyDependencies must be an object");
              uncertain("propertyDependencies");
              const item = currPropImm(key, checked(key));
              fun.if(item.checked ? true : present(item), () => {
                for (const [val, deps] of Object.entries(variants)) {
                  enforce(isSchemaish(deps), "propertyDependencies must contain schemas");
                  fun.if(compare(buildName(item), val), () => {
                    const delta = rule(current, deps, subPath("propertyDependencies", key, val), dyn);
                    evaluateDelta(orDelta({}, delta));
                    evaluateDeltaDynamic(delta);
                  });
                }
              });
            }
            return null;
          });
          handle("properties", ["object"], (properties) => {
            for (const p of Object.keys(properties)) {
              if (constProp === p) continue;
              rule(currPropImm(p, checked(p)), properties[p], subPath("properties", p));
            }
            evaluateDelta({ properties: Object.keys(properties) });
            return null;
          });
          prevWrap(node.patternProperties, () => {
            handle("patternProperties", ["object"], (patternProperties) => {
              forObjectKeys(current, (sub, key) => {
                for (const p of Object.keys(patternProperties)) {
                  enforceRegex(p, node.propertyNames || {});
                  fun.if(patternTestSafe(p, key), () => {
                    rule(sub, patternProperties[p], subPath("patternProperties", p));
                  });
                }
              });
              evaluateDelta({ patterns: Object.keys(patternProperties) });
              return null;
            });
            if (node.additionalProperties || node.additionalProperties === false) {
              const properties = Object.keys(node.properties || {});
              const patternProperties = Object.keys(node.patternProperties || {});
              if (node.additionalProperties === false) {
                finalLint.push(() => lintRequired(properties, patternProperties));
              }
              const condition = (key) => additionalCondition(key, properties, patternProperties);
              additionalProperties("additionalProperties", condition);
            }
          });
          if (getMeta().objectContains) {
            checkContains((run) => {
              forObjectKeys(current, (prop, i) => {
                run(prop, () => {
                  evaluateDelta({ dyn: { properties: [true] } });
                  evaluateDeltaDynamic({ propertiesVars: [i] });
                });
              });
            });
          }
        };
        const checkConst = () => {
          const handledConst = handle("const", ["jsonval"], (val) => safenot(compare(name, val)));
          if (handledConst && !allowUnusedKeywords) return true;
          const handledEnum = handle("enum", ["array"], (vals) => {
            const objects = vals.filter((value) => value && typeof value === "object");
            const primitive = vals.filter((value) => !(value && typeof value === "object"));
            return safenotor(...[...primitive, ...objects].map((value) => compare(name, value)));
          });
          return handledConst || handledEnum;
        };
        const checkContains = (iterate) => {
          handle("contains", ["object", "boolean"], () => {
            uncertain("contains");
            if (getMeta().objectContains && typeApplicable("array") && typeApplicable("object")) {
              enforceValidation("possible type confusion in 'contains',", "forbid 'object' or 'array'");
            }
            const passes = gensym("passes");
            fun.write("let %s = 0", passes);
            const suberr = suberror();
            iterate((prop, evaluate) => {
              const { sub } = subrule(suberr, prop, node.contains, subPath("contains"));
              fun.if(sub, () => {
                fun.write("%s++", passes);
                if (getMeta().containsEvaluates) {
                  enforce(!removeAdditional, `Can't use removeAdditional with draft2020+ "contains"`);
                  evaluate();
                }
              });
            });
            if (!handle("minContains", ["natural"], (mn) => format("%s < %d", passes, mn), { suberr }))
              errorIf(format("%s < 1", passes), { path: ["contains"], suberr });
            handle("maxContains", ["natural"], (max) => format("%s > %d", passes, max));
            enforceMinMax("minContains", "maxContains");
            return null;
          });
        };
        const checkGeneric = () => {
          handle("not", ["object", "boolean"], (not) => subrule(null, current, not, subPath("not")).sub);
          if (node.not) uncertain("not");
          const thenOrElse = node.then || node.then === false || node.else || node.else === false;
          if (thenOrElse || allowUnusedKeywords)
            handle("if", ["object", "boolean"], (ifS) => {
              uncertain("if/then/else");
              const { sub, delta: deltaIf } = subrule(null, current, ifS, subPath("if"), dyn);
              let handleElse, handleThen, deltaElse, deltaThen;
              handle("else", ["object", "boolean"], (elseS) => {
                handleElse = () => {
                  deltaElse = rule(current, elseS, subPath("else"), dyn);
                  evaluateDeltaDynamic(deltaElse);
                };
                return null;
              });
              handle("then", ["object", "boolean"], (thenS) => {
                handleThen = () => {
                  deltaThen = rule(current, thenS, subPath("then"), dyn);
                  evaluateDeltaDynamic(andDelta(deltaIf, deltaThen));
                };
                return null;
              });
              if (!handleThen && !deltaEmpty(deltaIf)) handleThen = () => evaluateDeltaDynamic(deltaIf);
              fun.if(sub, handleThen, handleElse);
              evaluateDelta(orDelta(deltaElse || {}, andDelta(deltaIf, deltaThen || {})));
              return null;
            });
          const performAllOf = (allOf, rulePath = "allOf") => {
            enforce(allOf.length > 0, `${rulePath} cannot be empty`);
            for (const [key, sch] of Object.entries(allOf))
              evaluateDelta(rule(current, sch, subPath(rulePath, key), dyn));
            return null;
          };
          handle("allOf", ["array"], (allOf) => performAllOf(allOf));
          let handleDiscriminator = null;
          handle("discriminator", ["object"], (discriminator) => {
            const seen = /* @__PURE__ */ new Set();
            const fix = (check, message, arg) => enforce(check, `[discriminator]: ${message}`, arg);
            const { propertyName: pname, mapping: map, ...e0 } = discriminator;
            const prop = currPropImm(pname);
            fix(pname && !node.oneOf !== !node.anyOf, "need propertyName, oneOf OR anyOf");
            fix(Object.keys(e0).length === 0, 'only "propertyName" and "mapping" are supported');
            const keylen = (obj) => isPlainObject(obj) ? Object.keys(obj).length : null;
            handleDiscriminator = (branches, ruleName) => {
              const runDiscriminator = () => {
                fun.write("switch (%s) {", buildName(prop));
                let delta;
                for (const [i, branch] of Object.entries(branches)) {
                  const { const: myval, enum: myenum, ...e1 } = (branch.properties || {})[pname] || {};
                  let vals = myval !== void 0 ? [myval] : myenum;
                  if (!vals && branch.$ref) {
                    const [sub] = resolveReference(root, schemas, branch.$ref, basePath())[0] || [];
                    enforce(isPlainObject(sub), "failed to resolve $ref:", branch.$ref);
                    const rprop = (sub.properties || {})[pname] || {};
                    vals = rprop.const !== void 0 ? [rprop.const] : rprop.enum;
                  }
                  const ok1 = Array.isArray(vals) && vals.length > 0;
                  fix(ok1, "branches should have unique string const or enum values for [propertyName]");
                  const ok2 = Object.keys(e1).length === 0 && (!myval || !myenum);
                  fix(ok2, "only const OR enum rules are allowed on [propertyName] in branches");
                  for (const val of vals) {
                    const okMapping = !map || functions.hasOwn(map, val) && map[val] === branch.$ref;
                    fix(okMapping, "mismatching mapping for", val);
                    const valok = typeof val === "string" && !seen.has(val);
                    fix(valok, "const/enum values for [propertyName] should be unique strings");
                    seen.add(val);
                    fun.write("case %j:", val);
                  }
                  const subd = rule(current, branch, subPath(ruleName, i), dyn, { constProp: pname });
                  evaluateDeltaDynamic(subd);
                  delta = delta ? orDelta(delta, subd) : subd;
                  fun.write("break");
                }
                fix(map === void 0 || keylen(map) === seen.size, "mismatching mapping size");
                evaluateDelta(delta);
                fun.write("default:");
                error({ path: [ruleName] });
                fun.write("}");
              };
              const propCheck = () => {
                if (!checked(pname)) {
                  const errorPath = ["discriminator", "propertyName"];
                  fun.if(present(prop), runDiscriminator, () => error({ path: errorPath, prop }));
                } else runDiscriminator();
              };
              if (allErrors || !functions.deepEqual(stat2.type, ["object"])) {
                fun.if(types.get("object")(name), propCheck, () => error({ path: ["discriminator"] }));
              } else propCheck();
              fix(functions.deepEqual(stat2.type, ["object"]), "has to be checked for type:", "object");
              fix(stat2.required.includes(pname), "propertyName should be placed in required:", pname);
              return null;
            };
            return null;
          });
          const uncertainBranchTypes = (key, arr) => {
            const btypes = arr.map((x) => x.type || (Array.isArray(x.const) ? "array" : typeof x.const));
            const maybeObj = btypes.filter((x) => !primitiveTypes.includes(x) && x !== "array").length;
            const maybeArr = btypes.filter((x) => !primitiveTypes.includes(x) && x !== "object").length;
            if (maybeObj > 1 || maybeArr > 1) uncertain(`${key}, use discriminator to make it certain`);
          };
          handle("anyOf", ["array"], (anyOf) => {
            enforce(anyOf.length > 0, "anyOf cannot be empty");
            if (anyOf.length === 1) return performAllOf(anyOf);
            if (handleDiscriminator) return handleDiscriminator(anyOf, "anyOf");
            const suberr = suberror();
            if (!canSkipDynamic()) {
              uncertainBranchTypes("anyOf", anyOf);
              const entries = Object.entries(anyOf).map(
                ([key, sch]) => subrule(suberr, current, sch, subPath("anyOf", key), dyn)
              );
              evaluateDelta(entries.map((x) => x.delta).reduce((acc, cur) => orDelta(acc, cur)));
              errorIf(safenotor(...entries.map(({ sub }) => sub)), { path: ["anyOf"], suberr });
              for (const { delta: delta2, sub } of entries) fun.if(sub, () => evaluateDeltaDynamic(delta2));
              return null;
            }
            const constBlocks = anyOf.filter((x) => functions.hasOwn(x, "const"));
            const otherBlocks = anyOf.filter((x) => !functions.hasOwn(x, "const"));
            uncertainBranchTypes("anyOf", otherBlocks);
            const blocks = [...constBlocks, ...otherBlocks];
            let delta;
            if (!getMeta().exclusiveRefs) {
              const entries = Object.entries(anyOf).map(
                ([key, sch]) => subrule(suberr, current, sch, subPath("anyOf", key), dyn)
              );
              delta = entries.map((x) => x.delta).reduce((acc, cur) => orDelta(acc, cur));
              errorIf(safenotor(...entries.map(({ sub }) => sub)), { path: ["anyOf"], suberr });
            } else {
              let body = () => error({ path: ["anyOf"], suberr });
              for (const [key, sch] of Object.entries(blocks).reverse()) {
                const oldBody = body;
                body = () => {
                  const { sub, delta: deltaVar } = subrule(suberr, current, sch, subPath("anyOf", key));
                  fun.if(safenot(sub), oldBody);
                  delta = delta ? orDelta(delta, deltaVar) : deltaVar;
                };
              }
              body();
            }
            evaluateDelta(delta);
            return null;
          });
          handle("oneOf", ["array"], (oneOf) => {
            enforce(oneOf.length > 0, "oneOf cannot be empty");
            if (oneOf.length === 1) return performAllOf(oneOf);
            if (handleDiscriminator) return handleDiscriminator(oneOf, "oneOf");
            uncertainBranchTypes("oneOf", oneOf);
            const passes = gensym("passes");
            fun.write("let %s = 0", passes);
            const suberr = suberror();
            let delta;
            let i = 0;
            const entries = Object.entries(oneOf).map(([key, sch]) => {
              if (!includeErrors && i++ > 1) errorIf(format("%s > 1", passes), { path: ["oneOf"] });
              const entry = subrule(suberr, current, sch, subPath("oneOf", key), dyn);
              fun.if(entry.sub, () => fun.write("%s++", passes));
              delta = delta ? orDelta(delta, entry.delta) : entry.delta;
              return entry;
            });
            evaluateDelta(delta);
            errorIf(format("%s !== 1", passes), { path: ["oneOf"] });
            fun.if(format("%s === 0", passes), () => mergeerror(suberr));
            for (const entry of entries) fun.if(entry.sub, () => evaluateDeltaDynamic(entry.delta));
            return null;
          });
        };
        const typeWrap = (checkBlock, validTypes, queryType) => {
          const [funSize, unusedSize] = [fun.size(), unused.size];
          fun.if(definitelyType(...validTypes) ? true : queryType, checkBlock);
          if (funSize !== fun.size() || unusedSize !== unused.size)
            enforce(typeApplicable(...validTypes), `Unexpected rules in type`, node.type);
        };
        const checkArraysFinal = () => {
          if (stat2.items === Infinity) {
            if (node.unevaluatedItems === false) consume("unevaluatedItems", "boolean");
          } else if (node.unevaluatedItems || node.unevaluatedItems === false) {
            if (isDynamic(stat2).items) {
              if (!opts[optDynamic]) throw new Error("[opt] Dynamic unevaluated tracing not enabled");
              const limit = format("Math.max(%d, ...%s)", stat2.items, dyn.items);
              const extra = (i) => format("%s.includes(%s)", dyn.item, i);
              additionalItems("unevaluatedItems", limit, getMeta().containsEvaluates ? extra : null);
            } else {
              additionalItems("unevaluatedItems", format("%d", stat2.items));
            }
          }
        };
        const checkObjectsFinal = () => {
          prevWrap(stat2.patterns.length > 0 || stat2.dyn.patterns.length > 0 || stat2.unknown, () => {
            if (stat2.properties.includes(true)) {
              if (node.unevaluatedProperties === false) consume("unevaluatedProperties", "boolean");
            } else if (node.unevaluatedProperties || node.unevaluatedProperties === false) {
              const notStatic = (key) => additionalCondition(key, stat2.properties, stat2.patterns);
              if (isDynamic(stat2).properties) {
                if (!opts[optDynamic]) throw new Error("[opt] Dynamic unevaluated tracing not enabled");
                scope.propertyIn = functions.propertyIn;
                const notDynamic = (key) => format("!propertyIn(%s, %s)", key, dyn.props);
                const condition = (key) => safeand(notStatic(key), notDynamic(key));
                additionalProperties("unevaluatedProperties", condition);
              } else {
                if (node.unevaluatedProperties === false) lintRequired(stat2.properties, stat2.patterns);
                additionalProperties("unevaluatedProperties", notStatic);
              }
            }
          });
        };
        const performValidation = () => {
          if (prev !== null) fun.write("const %s = errorCount", prev);
          if (checkConst()) {
            const typeKeys = [...types.keys()];
            evaluateDelta({ properties: [true], items: Infinity, type: typeKeys, fullstring: true });
            if (!allowUnusedKeywords) {
              enforce(unused.size === 0, "Unexpected keywords mixed with const or enum:", [...unused]);
              return;
            }
          }
          typeWrap(checkNumbers, ["number", "integer"], types.get("number")(name));
          typeWrap(checkStrings, ["string"], types.get("string")(name));
          typeWrap(checkArrays, ["array"], types.get("array")(name));
          typeWrap(checkObjects, ["object"], types.get("object")(name));
          checkGeneric();
          typeWrap(checkArraysFinal, ["array"], types.get("array")(name));
          typeWrap(checkObjectsFinal, ["object"], types.get("object")(name));
          for (const lint of finalLint) lint();
          applyDynamicToDynamic(trace, local2.item, local2.items, local2.props);
        };
        const writeMain = () => {
          if (local2.item) fun.write("const %s = []", local2.item);
          if (local2.items) fun.write("const %s = [0]", local2.items);
          if (local2.props) fun.write("const %s = [[], []]", local2.props);
          handle("$ref", ["string"], ($ref) => {
            const resolved = resolveReference(root, schemas, $ref, basePath());
            const [sub, subRoot, path] = resolved[0] || [];
            if (!sub && sub !== false) {
              fail("failed to resolve $ref:", $ref);
              if (lintOnly) return null;
            }
            const n = compileSub(sub, subRoot, path);
            const rn = sub === schema ? funname : n;
            if (!scope[rn]) throw new Error("Unexpected: coherence check failed");
            if (!scope[rn][evaluatedStatic] && sub.type) {
              const type = Array.isArray(sub.type) ? sub.type : [sub.type];
              evaluateDelta({ type });
              if (requireValidation) {
                refsNeedFullValidation.add(rn);
                if (type.includes("array")) evaluateDelta({ items: Infinity });
                if (type.includes("object")) evaluateDelta({ properties: [true] });
              }
              if (requireStringValidation && type.includes("string")) {
                refsNeedFullValidation.add(rn);
                evaluateDelta({ fullstring: true });
              }
            }
            return applyRef(n, { path: ["$ref"] });
          });
          if (getMeta().exclusiveRefs) {
            enforce(!opts[optDynamic], "unevaluated* is supported only on draft2019-09 and above");
            if (node.$ref) return;
          }
          handle("$recursiveRef", ["string"], ($recursiveRef) => {
            if (!opts[optRecAnchors]) throw new Error("[opt] Recursive anchors are not enabled");
            enforce($recursiveRef === "#", 'Behavior of $recursiveRef is defined only for "#"');
            const resolved = resolveReference(root, schemas, "#", basePath());
            const [sub, subRoot, path] = resolved[0];
            laxMode(sub.$recursiveAnchor, "$recursiveRef without $recursiveAnchor");
            const n = compileSub(sub, subRoot, path);
            const nrec = sub.$recursiveAnchor ? format("(recursive || %s)", n) : n;
            return applyRef(nrec, { path: ["$recursiveRef"] });
          });
          handle("$dynamicRef", ["string"], ($dynamicRef) => {
            if (!opts[optDynAnchors]) throw new Error("[opt] Dynamic anchors are not enabled");
            laxMode(/^[^#]*#[a-zA-Z0-9_-]+$/.test($dynamicRef), "Unsupported $dynamicRef format");
            const dynamicTail = $dynamicRef.replace(/^[^#]+/, "");
            const resolved = resolveReference(root, schemas, $dynamicRef, basePath());
            if (!resolved[0] && !getMeta().bookending) {
              laxMode(false, "$dynamicRef bookending resolution failed (even though not required)");
              scope.dynamicResolve = functions.dynamicResolve;
              const nrec2 = format("dynamicResolve(dynAnchors || [], %j)", dynamicTail);
              return applyRef(nrec2, { path: ["$dynamicRef"] });
            }
            enforce(resolved[0], "$dynamicRef bookending resolution failed", $dynamicRef);
            const [sub, subRoot, path] = resolved[0];
            const ok = sub.$dynamicAnchor && `#${sub.$dynamicAnchor}` === dynamicTail;
            laxMode(ok, "$dynamicRef without $dynamicAnchor in the same scope");
            const n = compileSub(sub, subRoot, path);
            scope.dynamicResolve = functions.dynamicResolve;
            const nrec = ok ? format("(dynamicResolve(dynAnchors || [], %j) || %s)", dynamicTail, n) : n;
            return applyRef(nrec, { path: ["$dynamicRef"] });
          });
          let typeCheck = null;
          handle("type", ["string", "array"], (type) => {
            const typearr = Array.isArray(type) ? type : [type];
            for (const t of typearr) enforce(typeof t === "string" && types.has(t), "Unknown type:", t);
            if (current.type) {
              enforce(functions.deepEqual(typearr, [current.type]), "One type allowed:", current.type);
              evaluateDelta({ type: [current.type] });
              return null;
            }
            if (parentCheckedType(...typearr)) return null;
            const filteredTypes = typearr.filter((t) => typeApplicable(t));
            if (filteredTypes.length === 0) fail("No valid types possible");
            evaluateDelta({ type: typearr });
            typeCheck = safenotor(...filteredTypes.map((t) => types.get(t)(name)));
            return null;
          });
          if (typeCheck && allErrors) {
            fun.if(typeCheck, () => error({ path: ["type"] }), performValidation);
          } else {
            if (typeCheck) errorIf(typeCheck, { path: ["type"] });
            performValidation();
          }
          if (stat2.items < Infinity && node.maxItems <= stat2.items) evaluateDelta({ items: Infinity });
        };
        if (node.default !== void 0 && useDefaults) {
          if (definitelyPresent) fail("Can not apply default value here (e.g. at root)");
          const defvalue = get("default", "jsonval");
          fun.if(present(current), writeMain, () => fun.write("%s = %j", name, defvalue));
        } else {
          handle("default", ["jsonval"], null);
          fun.if(definitelyPresent ? true : present(current), writeMain);
        }
        basePathStack.length = basePathStackLength;
        if (recursiveLog[0] && recursiveLog[recursiveLog.length - 1][0] === node) recursiveLog.pop();
        if (isDynScope && node !== schema) fun.write("dynLocal.shift()");
        if (!allowUnreachable) enforce(!fun.optimizedOut, "some checks are never reachable");
        if (isSub) {
          const logicalOp = ["not", "if", "then", "else"].includes(schemaPath[schemaPath.length - 1]);
          const branchOp = ["oneOf", "anyOf", "allOf"].includes(schemaPath[schemaPath.length - 2]);
          const depOp = ["dependencies", "dependentSchemas"].includes(schemaPath[schemaPath.length - 2]);
          const propDepOp = ["propertyDependencies"].includes(schemaPath[schemaPath.length - 3]);
          enforce(logicalOp || branchOp || depOp || propDepOp, "Unexpected logical path");
        } else if (!schemaPath.includes("not")) {
          const isRefTop = schema !== root && node === schema;
          if (!isRefTop || refsNeedFullValidation.has(funname)) {
            refsNeedFullValidation.delete(funname);
            if (!stat2.type) enforceValidation("type");
            if (typeApplicable("array") && stat2.items !== Infinity)
              enforceValidation(node.items ? "additionalItems or unevaluatedItems" : "items rule");
            if (typeApplicable("object") && !stat2.properties.includes(true))
              enforceValidation("additionalProperties or unevaluatedProperties");
            if (!stat2.fullstring && requireStringValidation) {
              const stringWarning = "pattern, format or contentSchema should be specified for strings";
              fail(`[requireStringValidation] ${stringWarning}, use pattern: ^[\\s\\S]*$ to opt-out`);
            }
          }
          if (typeof node.propertyNames !== "object") {
            for (const sub of ["additionalProperties", "unevaluatedProperties"])
              if (node[sub]) enforceValidation(`wild-card ${sub}`, "requires propertyNames");
          }
        }
        if (node.properties && !node.required) enforceValidation("if properties is used, required");
        enforce(unused.size === 0 || allowUnusedKeywords, "Unprocessed keywords:", [...unused]);
        return { stat: stat2, local: local2 };
      };
      const { stat, local } = visit(format("validate.errors"), [], { name: safe("data") }, schema, []);
      if (refsNeedFullValidation.has(funname)) throw new Error("Unexpected: unvalidated cyclic ref");
      if (opts[optDynamic] && (isDynamic(stat).items || isDynamic(stat).properties)) {
        if (!local) throw new Error("Failed to trace dynamic properties");
        fun.write("validate.evaluatedDynamic = [%s, %s, %s]", local.item, local.items, local.props);
      }
      if (allErrors) fun.write("return errorCount === 0");
      else fun.write("return true");
      fun.write("}");
      if (!lintOnly) {
        validate = fun.makeFunction(scope);
        delete scope[funname];
        scope[funname] = validate;
      }
      scope[funname][evaluatedStatic] = stat;
      return funname;
    };
    var compile = (schemas, opts) => {
      if (!Array.isArray(schemas)) throw new Error("Expected an array of schemas");
      try {
        const scope = /* @__PURE__ */ Object.create(null);
        const { getref } = scopeMethods(scope);
        refsNeedFullValidation.clear();
        rootMeta.clear();
        const refs = schemas.map((s) => getref(s) || compileSchema(s, s, opts, scope));
        if (refsNeedFullValidation.size !== 0) throw new Error("Unexpected: not all refs are validated");
        return { scope, refs };
      } catch (e) {
        if (!opts[optDynamic] && e.message === "[opt] Dynamic unevaluated tracing not enabled")
          return compile(schemas, { ...opts, [optDynamic]: true });
        if (!opts[optDynAnchors] && e.message === "[opt] Dynamic anchors are not enabled")
          return compile(schemas, { ...opts, [optDynAnchors]: true });
        if (!opts[optRecAnchors] && e.message === "[opt] Recursive anchors are not enabled")
          return compile(schemas, { ...opts, [optRecAnchors]: true });
        throw e;
      } finally {
        refsNeedFullValidation.clear();
        rootMeta.clear();
      }
    };
    module.exports = { compile };
  }
});

// node_modules/@exodus/schemasafe/src/index.js
var require_index = __commonJS({
  "node_modules/@exodus/schemasafe/src/index.js"(exports, module) {
    var genfun = require_generate_function();
    var { buildSchemas } = require_pointer();
    var { compile } = require_compile();
    var { deepEqual } = require_scope_functions();
    var jsonCheckWithErrors = (validate) => function validateIsJSON(data) {
      if (!deepEqual(data, JSON.parse(JSON.stringify(data)))) {
        validateIsJSON.errors = [{ instanceLocation: "#", error: "not JSON compatible" }];
        return false;
      }
      const res = validate(data);
      validateIsJSON.errors = validate.errors;
      return res;
    };
    var jsonCheckWithoutErrors = (validate) => (data) => deepEqual(data, JSON.parse(JSON.stringify(data))) && validate(data);
    var validator = (schema, { parse = false, multi = false, jsonCheck = false, isJSON = false, schemas = [], ...opts } = {}) => {
      if (jsonCheck && isJSON) throw new Error("Can not specify both isJSON and jsonCheck options");
      if (parse && (jsonCheck || isJSON))
        throw new Error("jsonCheck and isJSON options are not applicable in parser mode");
      const mode = parse ? "strong" : "default";
      const willJSON = isJSON || jsonCheck || parse;
      const arg = multi ? schema : [schema];
      const options = { mode, ...opts, schemas: buildSchemas(schemas, arg), isJSON: willJSON };
      const { scope, refs } = compile(arg, options);
      if (opts.dryRun) return;
      if (opts.lint) return scope.lintErrors;
      const fun = genfun();
      if (parse) {
        scope.parseWrap = opts.includeErrors ? parseWithErrors : parseWithoutErrors;
      } else if (jsonCheck) {
        scope.deepEqual = deepEqual;
        scope.jsonCheckWrap = opts.includeErrors ? jsonCheckWithErrors : jsonCheckWithoutErrors;
      }
      if (multi) {
        fun.write("[");
        for (const ref of refs.slice(0, -1)) fun.write("%s,", ref);
        if (refs.length > 0) fun.write("%s", refs[refs.length - 1]);
        fun.write("]");
        if (parse) fun.write(".map(parseWrap)");
        else if (jsonCheck) fun.write(".map(jsonCheckWrap)");
      } else {
        if (parse) fun.write("parseWrap(%s)", refs[0]);
        else if (jsonCheck) fun.write("jsonCheckWrap(%s)", refs[0]);
        else fun.write("%s", refs[0]);
      }
      const validate = fun.makeFunction(scope);
      validate.toModule = ({ semi = true } = {}) => fun.makeModule(scope) + (semi ? ";" : "");
      validate.toJSON = () => schema;
      return validate;
    };
    var parseWithErrors = (validate) => (src) => {
      if (typeof src !== "string") return { valid: false, error: "Input is not a string" };
      try {
        const value = JSON.parse(src);
        if (!validate(value)) {
          const { keywordLocation, instanceLocation } = validate.errors[0];
          const keyword = keywordLocation.slice(keywordLocation.lastIndexOf("/") + 1);
          const error = `JSON validation failed for ${keyword} at ${instanceLocation}`;
          return { valid: false, error, errors: validate.errors };
        }
        return { valid: true, value };
      } catch ({ message }) {
        return { valid: false, error: message };
      }
    };
    var parseWithoutErrors = (validate) => (src) => {
      if (typeof src !== "string") return { valid: false };
      try {
        const value = JSON.parse(src);
        if (!validate(value)) return { valid: false };
        return { valid: true, value };
      } catch (e) {
        return { valid: false };
      }
    };
    var parser = function(schema, { parse = true, ...opts } = {}) {
      if (!parse) throw new Error("can not disable parse in parser");
      return validator(schema, { parse, ...opts });
    };
    var lint = function(schema, { lint: lintOption = true, ...opts } = {}) {
      if (!lintOption) throw new Error("can not disable lint option in lint()");
      return validator(schema, { lint: lintOption, ...opts });
    };
    module.exports = { validator, parser, lint };
  }
});
export default require_index();
