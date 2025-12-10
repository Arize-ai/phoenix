/**
 * Checks if a string is a valid JSON string.
 * @param {Object} options - The options object.
 * @param {string} options.str - The string to check.
 * @param {boolean} [options.excludePrimitives=false] - Whether to exclude primitive types from the check.
 * @param {boolean} [options.excludeArray=false] - Whether to exclude arrays from the check.
 * @param {boolean} [options.excludeNull=false] - Whether to exclude null from the check.
 * @returns {boolean} - Returns true if the string is a valid JSON string, false otherwise.
 */
export function isJSONString({
  str,
  excludePrimitives = false,
  excludeArray = false,
  excludeNull = false,
}: {
  str: string;
  excludePrimitives?: boolean;
  excludeArray?: boolean;
  excludeNull?: boolean;
}) {
  try {
    const parsed = JSON.parse(str);
    if (excludePrimitives && typeof parsed !== "object") {
      return false;
    }
    if (excludeArray && Array.isArray(parsed)) {
      return false;
    }
    if (excludeNull && parsed === null) {
      return false;
    }
  } catch {
    return false;
  }
  return true;
}

/**
 * Checks if a string is a valid JSON object string (excludes arrays and primitives).
 *
 * @param str - The string to check.
 * @returns `true` if the string is a valid JSON object, `false` otherwise.
 *
 * @example
 * ```ts
 * isJSONObjectString('{"a": 1}') // true
 * isJSONObjectString('[1, 2]')   // false (array)
 * isJSONObjectString('123')      // false (primitive)
 * ```
 */
export function isJSONObjectString(str: string) {
  return isJSONString({ str, excludeArray: true, excludePrimitives: true });
}

/**
 * Safely parses a JSON string, returning the result and any parse error.
 *
 * @param str - The JSON string to parse.
 * @returns An object with `json` containing the parsed value, or `json: null` and `parseError` if parsing failed.
 *
 * @example
 * ```ts
 * safelyParseJSON('{"a": 1}') // { json: { a: 1 } }
 * safelyParseJSON('invalid')  // { json: null, parseError: SyntaxError }
 * ```
 */
export function safelyParseJSON(str: string) {
  try {
    return { json: JSON.parse(str) };
  } catch (e) {
    return { json: null, parseError: e };
  }
}

/**
 * Safely stringifies a value to JSON, returning the result and any stringify error.
 *
 * @param args - Arguments to pass to `JSON.stringify` (value, replacer, space).
 * @returns An object with `json` containing the stringified value, or `json: null` and `stringifyError` if stringification failed.
 *
 * @example
 * ```ts
 * safelyStringifyJSON({ a: 1 })           // { json: '{"a":1}' }
 * safelyStringifyJSON(circularRef)        // { json: null, stringifyError: TypeError }
 * safelyStringifyJSON({ a: 1 }, null, 2)  // { json: '{\n  "a": 1\n}' }
 * ```
 */
export function safelyStringifyJSON(
  ...args: Parameters<typeof JSON.stringify>
) {
  try {
    return { json: JSON.stringify(...args) };
  } catch (e) {
    return { json: null, stringifyError: e };
  }
}

/**
 * Flattens an object into a single-level object.
 */
export function flattenObject({
  obj,
  parentKey = "",
  separator = ".",
  keepNonTerminalValues = false,
}: {
  obj: object;
  parentKey?: string;
  separator?: string;
  keepNonTerminalValues?: boolean;
}) {
  const result: Record<string, string | boolean | number> = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = parentKey ? `${parentKey}${separator}${key}` : key;

    if (value && typeof value === "object") {
      if (keepNonTerminalValues) {
        result[newKey] = value;
      }
      Object.assign(
        result,
        flattenObject({
          obj: value,
          parentKey: newKey,
          separator,
          keepNonTerminalValues,
        })
      );
    } else {
      result[newKey] = value;
    }
  }
  return result;
}

/**
 * A function that flattens a JSON string into a single-level object.
 * @param jsonString - The JSON string to flatten.
 */
export function jsonStringToFlatObject(
  jsonString: string,
  separator: string = "."
): Record<string, string | boolean | number> {
  try {
    // Parse the JSON string into an object
    const parsedObj = JSON.parse(jsonString);
    if (typeof parsedObj !== "object") {
      return {};
    }
    // Flatten the parsed object
    return flattenObject({ obj: parsedObj, separator });
  } catch {
    // The parsing failed, do nothing
  }
  return {} satisfies Record<string, string | boolean | number>;
}

/**
 * Formats content of any type into a string suitable for rendering.
 *
 * By default returns valid JSON (plain strings are JSON-quoted). Use unquotePlainString for readable display.
 *
 * - Strings: Unwraps double-stringified JSON (e.g. "\"{\\"foo\\":1}\"") and pretty-prints;
 *   otherwise returns plain string JSON-quoted (valid JSON) or unquoted when unquotePlainString is true.
 * - Objects/arrays: Pretty-printed JSON.
 * - Primitives (number, boolean, null): String form (e.g. "123", "true", "null").
 * - undefined: Returns the string "undefined".
 *
 * @param content - the content to format
 * @param options.unquotePlainString - when true, plain string content is returned as-is (unquoted) for readable display; default false returns valid JSON (quoted)
 * @returns a formatted string representation of the content
 */
export function formatContentAsString(
  content?: unknown,
  options?: { unquotePlainString?: boolean }
): string {
  const unquotePlainString = options?.unquotePlainString ?? false;

  if (typeof content === "string") {
    const isDoubleStringified =
      content.startsWith('"{') ||
      content.startsWith('"[') ||
      content.startsWith('"\\"');
    try {
      // If it's a double-stringified value, parse it twice
      if (isDoubleStringified) {
        // First parse removes the outer quotes and unescapes the inner content
        const firstParse = JSON.parse(content);
        // Second parse converts the string representation to actual JSON
        const secondParse =
          typeof firstParse === "string" ? JSON.parse(firstParse) : firstParse;
        // Stringify the result to ensure consistent formatting
        return JSON.stringify(secondParse, null, 2);
      }
    } catch {
      // If parsing fails, fall through
    }
    // Plain text string or unparseable content
    if (unquotePlainString) {
      return content;
    }
    return JSON.stringify(content);
  }

  // Objects, arrays, and primitives: pretty-print as JSON when possible
  try {
    const out = JSON.stringify(content, null, 2);
    if (out !== undefined) return out;
  } catch {
    // BigInt and other non-serializable values
  }
  return String(content);
}

/*
 * Serializes a value to a JSON string.
 *
 * @returns undefined for null/undefined values, or if serialization fails
 */
export function safelyJSONStringify(value: unknown): string | undefined {
  // If the value is nullish, it's not worth trying to preserve it
  if (value == null) return undefined;
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}
/**
 * Safely parses a JSON string into any valid JSON value.
 *
 * Unlike {@link safelyParseJSON}, this function returns `undefined` on failure
 * instead of an error object, making it simpler for cases where error details
 * are not needed.
 *
 * @param value - The JSON string to parse.
 * @returns The parsed value, or `undefined` if the string is empty, whitespace-only, or invalid JSON.
 *
 * @example
 * ```ts
 * safelyParseJSONString('{"a": 1}')  // { a: 1 }
 * safelyParseJSONString('[1, 2, 3]') // [1, 2, 3]
 * safelyParseJSONString('42')        // 42
 * safelyParseJSONString('')          // undefined
 * safelyParseJSONString('   ')       // undefined
 * safelyParseJSONString('invalid')   // undefined
 * ```
 */
export function safelyParseJSONString(value: string): unknown | undefined {
  if (!value.trim()) {
    return undefined;
  }

  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

/**
 * Safely parses a JSON string into an object or array.
 *
 * This is a stricter version of {@link safelyParseJSONString} that only returns
 * objects and arrays, filtering out primitives like strings, numbers, and booleans.
 *
 * @param value - The JSON string to parse.
 * @returns The parsed object or array, or `undefined` if the string is empty,
 *          invalid JSON, or parses to a primitive value (including `null`).
 *
 * @example
 * ```ts
 * safelyParseJSONObjectString('{"a": 1}')  // { a: 1 }
 * safelyParseJSONObjectString('[1, 2, 3]') // [1, 2, 3]
 * safelyParseJSONObjectString('42')        // undefined (primitive)
 * safelyParseJSONObjectString('"hello"')   // undefined (primitive)
 * safelyParseJSONObjectString('null')      // undefined (null)
 * safelyParseJSONObjectString('')          // undefined
 * safelyParseJSONObjectString('invalid')   // undefined
 * ```
 */
export function safelyParseJSONObjectString(value: string): object | undefined {
  const parsed = safelyParseJSONString(value);
  if (typeof parsed !== "object" || parsed === null) {
    return undefined;
  }
  return parsed;
}
