import { isStringKeyedObject } from "@phoenix/typeUtils";

/**
 * Type guard for plain objects (excludes arrays and null).
 * Use this when you need to check if a value is a "dictionary-like" object.
 */
export function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  return isStringKeyedObject(value) && !Array.isArray(value);
}

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
 * Recursively expands stringified JSON throughout nested objects and arrays so
 * that a value like `{ "messages": "[{\"role\":\"user\"}]" }` reads as a single
 * JSON tree. Values that are not stringified JSON are left untouched.
 *
 * @example
 * ```ts
 * expandStringifiedJSON({ a: '{"b": 1}' }) // { a: { b: 1 } }
 * expandStringifiedJSON({ a: "hello" })    // { a: "hello" }
 * ```
 */
export function expandStringifiedJSON(value: unknown): unknown {
  if (typeof value === "string") {
    const parsed = safelyParseJSONObjectString(value);
    // a string that does not hold an object or array is itself the leaf
    return parsed === undefined ? value : expandStringifiedJSON(parsed);
  }

  if (Array.isArray(value)) {
    return value.map(expandStringifiedJSON);
  }

  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, val]) => [
        key,
        expandStringifiedJSON(val),
      ])
    );
  }

  return value;
}

/**
 * Checks whether a value contains stringified JSON that
 * {@link expandStringifiedJSON} would expand.
 */
export function hasStringifiedJSON(value: unknown): boolean {
  if (typeof value === "string") {
    return safelyParseJSONObjectString(value) !== undefined;
  }

  if (Array.isArray(value)) {
    return value.some(hasStringifiedJSON);
  }

  if (typeof value === "object" && value !== null) {
    return Object.values(value).some(hasStringifiedJSON);
  }

  return false;
}

/**
 * A single leaf of a JSON tree, addressed by its flattened path.
 */
export type FlatJSONEntry = {
  /**
   * The delimited path to the value, e.g. `llm.input_messages[0].content`.
   */
  key: string;
  /**
   * The leaf value at the key. Primitives, plus empty objects and arrays, which
   * have no leaves of their own but are worth surfacing.
   */
  value: unknown;
};

/**
 * How an array item is addressed in a flattened key.
 *
 * - `bracket` — `messages[0].content`, the JSONPath form
 * - `dot` — `messages.0.content`, the form OpenTelemetry uses for its
 *   attribute keys, so the key can be pasted straight into instrumentation
 */
export type FlatJSONIndexNotation = "bracket" | "dot";

/** Joins the segments of a flattened key. */
const KEY_SEPARATOR = ".";

/**
 * Appends an array index to a flattened key in the requested notation.
 */
function appendIndex({
  parentKey,
  index,
  indexNotation,
}: {
  parentKey: string;
  index: number;
  indexNotation: FlatJSONIndexNotation;
}): string {
  if (indexNotation === "bracket") {
    return `${parentKey}[${index}]`;
  }
  // a root array has nothing to separate the index from
  return parentKey ? `${parentKey}${KEY_SEPARATOR}${index}` : String(index);
}

/**
 * Flattens a JSON value into an ordered list of leaf entries, keyed by their
 * path. Object keys are joined with `.`, array items are addressed according to
 * `indexNotation`.
 *
 * Unlike {@link flattenObject} this preserves the order of the source document
 * and keeps empty objects and arrays, which would otherwise vanish.
 *
 * A root that is not an object or an array yields no entries — there is no key
 * to flatten it under.
 *
 * Keys are not unique: a recorded key holding a `.` collides with a nested one,
 * so `{ "a.b": 1, a: { b: 2 } }` yields two entries both keyed `a.b`. Callers
 * that need to round-trip the result must keep it as a list.
 *
 * @example
 * ```ts
 * toFlatJSONEntries({ value: { a: { b: 1 }, c: [2] } })
 * // [{ key: "a.b", value: 1 }, { key: "c[0]", value: 2 }]
 *
 * toFlatJSONEntries({ value: { c: [2] }, indexNotation: "dot" })
 * // [{ key: "c.0", value: 2 }]
 * ```
 */
export function toFlatJSONEntries({
  value,
  indexNotation = "bracket",
  parentKey = "",
}: {
  value: unknown;
  /**
   * How array items are addressed.
   * @default "bracket"
   */
  indexNotation?: FlatJSONIndexNotation;
  /**
   * The key the value is nested under. Used when recursing.
   */
  parentKey?: string;
}): FlatJSONEntry[] {
  if (Array.isArray(value) && value.length > 0) {
    return value.flatMap((item, index) =>
      toFlatJSONEntries({
        value: item,
        indexNotation,
        parentKey: appendIndex({ parentKey, index, indexNotation }),
      })
    );
  }

  if (isPlainObject(value) && Object.keys(value).length > 0) {
    return Object.entries(value).flatMap(([key, val]) =>
      toFlatJSONEntries({
        value: val,
        indexNotation,
        parentKey: parentKey ? `${parentKey}${KEY_SEPARATOR}${key}` : key,
      })
    );
  }

  return parentKey === "" ? [] : [{ key: parentKey, value }];
}

/**
 * Formats a {@link FlatJSONEntry} value for display and copying. Strings are
 * shown as-is so they stay readable; everything else is JSON encoded.
 *
 * @example
 * ```ts
 * formatFlatJSONValue("hello") // "hello"
 * formatFlatJSONValue(null)    // "null"
 * formatFlatJSONValue([])      // "[]"
 * ```
 */
export function formatFlatJSONValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  return safelyStringifyJSON(value).json ?? String(value);
}

/**
 * Filters flattened entries down to those whose key or formatted value contains
 * the query, case-insensitively. An empty query matches everything.
 */
export function filterFlatJSONEntries({
  entries,
  query,
}: {
  entries: FlatJSONEntry[];
  query: string;
}): FlatJSONEntry[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return entries;
  }
  return entries.filter(
    ({ key, value }) =>
      key.toLowerCase().includes(normalizedQuery) ||
      formatFlatJSONValue(value).toLowerCase().includes(normalizedQuery)
  );
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
