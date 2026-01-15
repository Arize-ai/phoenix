import { isStringKeyedObject } from "@phoenix/typeUtils";

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
  formatIndices = false,
}: {
  obj: object;
  /**
   * The parent key to use for nested objects.
   */
  parentKey?: string;
  /**
   * The separator to use between keys.
   */
  separator?: string;
  /**
   * If true, non-terminal values will be kept in the result.
   * For example, if the object is `{ a: { b: 1 } }` and `keepNonTerminalValues` is true,
   * the result will be `{ a: { b: 1 }, a.b: 1 }`.
   */
  keepNonTerminalValues?: boolean;
  /**
   * If true, the indices (key names) will be formatted like [0] instead of .0
   */
  formatIndices?: boolean;
}) {
  const result: Record<string, string | boolean | number> = {};

  for (const [key, value] of Object.entries(obj)) {
    let newKey: string;
    if (formatIndices && Array.isArray(obj)) {
      // For arrays with formatIndices, use bracket notation: parentKey[0] or just [0]
      newKey = parentKey ? `${parentKey}[${key}]` : `[${key}]`;
    } else if (parentKey) {
      newKey = `${parentKey}${separator}${key}`;
    } else {
      newKey = key;
    }

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
          formatIndices,
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
 * Handles double-stringified JSON, pretty-prints objects and arrays,
 * and preserves valid top-level JSON values.
 *
 * @param content - the content to format
 * @returns a formatted string representation of the content
 */
export function formatContentAsString(content?: unknown): string {
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
    // If the content is a valid non-string top level json value, return it as-is
    // https://datatracker.ietf.org/doc/html/rfc7159#section-3
    // 0-9 { [ null false true
    // a regex that matches possible top level json values, besides strings
    const nonStringStart = /^\s*[0-9{[]|true|false|null/.test(content);
    if (nonStringStart) {
      return content;
    }
  }

  // For any content that doesn't match the json spec for a top level value, stringify it with pretty printing
  return JSON.stringify(content, null, 2);
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

export type UnnestResult =
  | { value: unknown; wasUnnested: false }
  | { value: string; wasUnnested: true };

/**
 * Unnests a value if it's an object with a single string key whose value is a string.
 * This is useful for displaying wrapped responses like `{"response": "..."}` as just the string content.
 *
 * @returns An object with the value and whether it was unnested.
 *
 * @example
 * ```ts
 * unnestSingleStringValue({ "response": "Hello world" })
 * // { value: "Hello world", wasUnnested: true }
 *
 * unnestSingleStringValue({ "a": "1", "b": "2" })
 * // { value: { "a": "1", "b": "2" }, wasUnnested: false }
 *
 * unnestSingleStringValue({ "data": { "nested": true } })
 * // { value: { "data": { "nested": true } }, wasUnnested: false }
 *
 * unnestSingleStringValue("plain string")
 * // { value: "plain string", wasUnnested: false }
 * ```
 */
/**
 * Recursively clears values in a JSON structure while preserving the structure itself.
 * - Strings become empty strings
 * - Numbers and booleans are preserved
 * - Arrays are recursively cleared (empty arrays remain empty)
 * - Objects have their values recursively cleared
 * - null/undefined become empty strings
 *
 * @param obj - The value to clear
 * @returns A new value with the same structure but cleared string values
 *
 * @example
 * ```ts
 * clearJSONValues({ name: "John", age: 30 })
 * // { name: "", age: 30 }
 *
 * clearJSONValues({ items: ["a", "b"] })
 * // { items: ["", ""] }
 *
 * clearJSONValues({ nested: { value: "test" } })
 * // { nested: { value: "" } }
 * ```
 */
export function clearJSONValues(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return "";
  }
  if (Array.isArray(obj)) {
    return obj.length > 0 ? obj.map(clearJSONValues) : [];
  }
  if (typeof obj === "object") {
    const cleared: Record<string, unknown> = {};
    for (const key in obj) {
      cleared[key] = clearJSONValues((obj as Record<string, unknown>)[key]);
    }
    return cleared;
  }
  // Primitive values (string, number, boolean)
  if (typeof obj === "string") {
    return "";
  }
  if (typeof obj === "number") {
    return obj;
  }
  if (typeof obj === "boolean") {
    return obj;
  }
  return "";
}

/**
 * Creates an empty JSON structure based on an existing JSON string,
 * preserving keys but clearing all string values.
 *
 * @param jsonString - The JSON string to use as a template
 * @returns A JSON string with the same structure but cleared string values,
 *          or a default empty object template if parsing fails
 *
 * @example
 * ```ts
 * createEmptyJSONStructure('{"name": "John", "age": 30}')
 * // '{\n  "name": "",\n  "age": 30\n}'
 *
 * createEmptyJSONStructure('invalid json')
 * // '{\n  \n}'
 * ```
 */
export function createEmptyJSONStructure(jsonString: string): string {
  try {
    const parsed = JSON.parse(jsonString);
    const cleared = clearJSONValues(parsed);
    return JSON.stringify(cleared, null, 2);
  } catch {
    return "{\n  \n}";
  }
}

export function unnestSingleStringValue(value: unknown): UnnestResult {
  if (!isStringKeyedObject(value)) {
    return { value, wasUnnested: false };
  }

  const keys = Object.keys(value);

  // Only unnest if there's exactly one key
  if (keys.length !== 1) {
    return { value, wasUnnested: false };
  }

  const singleValue = value[keys[0]];

  // Only unnest if the value is a string
  if (typeof singleValue !== "string") {
    return { value, wasUnnested: false };
  }

  return { value: singleValue, wasUnnested: true };
}
