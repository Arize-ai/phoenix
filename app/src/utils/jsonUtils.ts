import { isStringKeyedObject } from "@phoenix/typeUtils";

/**
 * Type guard for plain objects (excludes arrays and null).
 * Use this when you need to check if a value is a "dictionary-like" object.
 */
export function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).every((key) => typeof key === "string")
  );
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

// ============================================================================
// Collapse Utilities
// Used for "collapsing" top-level keys during dataset upload, promoting their
// immediate children to become top-level keys.
// ============================================================================

/**
 * Result of computing collapsed keys from collapsible keys.
 */
export type CollapseKeysResult = {
  /**
   * The new set of keys after collapsing.
   * Parent keys that were collapsed are removed, their children are added.
   */
  collapsedKeys: string[];
  /**
   * Keys that were actually collapsed (had their children promoted).
   */
  keysToCollapse: string[];
  /**
   * Keys that could not be collapsed due to conflicts with other keys.
   * Maps the excluded key to the list of conflicting child keys.
   */
  excludedDueToConflicts: Map<string, string[]>;
};

/**
 * Computes the collapsed keys from a set of original keys and collapsible keys.
 *
 * When a key is collapsed, it is removed and its children are promoted to top-level.
 * If collapsing would create duplicate keys (conflicts), those parent keys are
 * excluded from collapsing.
 *
 * @param originalKeys - All keys in the data (top-level)
 * @param collapsibleKeys - Keys that have object values and can be collapsed
 * @param previewRows - Sample data rows used to extract child keys
 * @returns The result containing collapsed keys and conflict information
 *
 * @example
 * ```ts
 * // Given data: {"input": {"question": "..."}, "output": {"answer": "..."}}
 * computeCollapsedKeys(
 *   ["input", "output"],
 *   ["input", "output"],
 *   [{ input: { question: "What?" }, output: { answer: "Yes" } }]
 * )
 * // Returns: { collapsedKeys: ["question", "answer"], keysToCollapse: ["input", "output"], ... }
 * ```
 */
export function computeCollapsedKeys(
  originalKeys: string[],
  collapsibleKeys: string[],
  previewRows: Record<string, unknown>[]
): CollapseKeysResult {
  // Collect all child keys for each collapsible parent
  const childKeysByParent = new Map<string, Set<string>>();

  for (const parentKey of collapsibleKeys) {
    const childKeys = new Set<string>();
    for (const row of previewRows) {
      const value = row[parentKey];
      if (isPlainObject(value)) {
        for (const childKey of Object.keys(value)) {
          childKeys.add(childKey);
        }
      }
    }
    childKeysByParent.set(parentKey, childKeys);
  }

  // Detect conflicts: child keys that would clash with other keys
  // A conflict occurs when:
  // 1. A child key matches an original top-level key (whether collapsible or not)
  // 2. A child key matches another parent's child key
  const excludedDueToConflicts = new Map<string, string[]>();
  const keysToCollapse: string[] = [];

  // All original keys - a child key cannot match any of these
  const originalKeysSet = new Set(originalKeys);

  // Track all child keys we've seen so far to detect inter-parent conflicts
  const seenChildKeys = new Map<string, string>(); // childKey -> parentKey

  for (const parentKey of collapsibleKeys) {
    const childKeys = childKeysByParent.get(parentKey) || new Set();
    const conflicts: string[] = [];

    for (const childKey of childKeys) {
      // Check conflict with any original top-level key (except the parent itself)
      if (originalKeysSet.has(childKey) && childKey !== parentKey) {
        conflicts.push(childKey);
        continue;
      }
      // Check conflict with another parent's children
      const existingParent = seenChildKeys.get(childKey);
      if (existingParent && existingParent !== parentKey) {
        conflicts.push(childKey);
        continue;
      }
    }

    if (conflicts.length > 0) {
      excludedDueToConflicts.set(parentKey, conflicts);
    } else {
      keysToCollapse.push(parentKey);
      // Register all this parent's child keys
      for (const childKey of childKeys) {
        seenChildKeys.set(childKey, parentKey);
      }
    }
  }

  // Build the final collapsed keys list
  const collapsedKeys: string[] = [];
  const keysToCollapseSet = new Set(keysToCollapse);

  for (const key of originalKeys) {
    if (keysToCollapseSet.has(key)) {
      // Replace parent with its children
      const childKeys = childKeysByParent.get(key) || new Set();
      for (const childKey of childKeys) {
        if (!collapsedKeys.includes(childKey)) {
          collapsedKeys.push(childKey);
        }
      }
    } else {
      // Keep the original key
      collapsedKeys.push(key);
    }
  }

  return {
    collapsedKeys,
    keysToCollapse,
    excludedDueToConflicts,
  };
}

/**
 * Collapses a single row of data by promoting children of collapsed keys.
 *
 * @param row - The original data row
 * @param keysToCollapse - Keys whose children should be promoted
 * @returns A new row with collapsed structure
 *
 * @example
 * ```ts
 * collapseRow(
 *   { input: { question: "What?" }, output: { answer: "Yes" }, id: 1 },
 *   ["input", "output"]
 * )
 * // Returns: { question: "What?", answer: "Yes", id: 1 }
 * ```
 */
export function collapseRow(
  row: Record<string, unknown>,
  keysToCollapse: string[]
): Record<string, unknown> {
  const keysToCollapseSet = new Set(keysToCollapse);
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    if (keysToCollapseSet.has(key) && isPlainObject(value)) {
      // Promote children to top level
      Object.assign(result, value);
    } else {
      // Keep the key as-is
      result[key] = value;
    }
  }

  return result;
}

/**
 * Collapses multiple rows of data.
 *
 * @param rows - The original data rows
 * @param keysToCollapse - Keys whose children should be promoted
 * @returns New rows with collapsed structure
 */
export function collapseRows(
  rows: Record<string, unknown>[],
  keysToCollapse: string[]
): Record<string, unknown>[] {
  return rows.map((row) => collapseRow(row, keysToCollapse));
}

/**
 * For CSV data: parses JSON cells and collapses the specified columns.
 *
 * @param columns - Column names
 * @param rows - Row data as string arrays
 * @param keysToCollapse - Column names to collapse (must contain valid JSON objects)
 * @returns Object with collapsed column names and transformed row data
 */
export function collapseCSVData(
  columns: string[],
  rows: string[][],
  keysToCollapse: string[]
): {
  collapsedColumns: string[];
  collapsedRows: Record<string, unknown>[];
} {
  const keysToCollapseSet = new Set(keysToCollapse);

  // First, convert CSV rows to objects and parse JSON for collapsible columns
  const objectRows: Record<string, unknown>[] = rows.map((row) => {
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < columns.length; i++) {
      const colName = columns[i];
      const cellValue = row[i] ?? "";

      if (keysToCollapseSet.has(colName)) {
        // Parse JSON for collapsible columns
        const parsed = safelyParseJSONString(cellValue);
        obj[colName] = isPlainObject(parsed) ? parsed : cellValue;
      } else {
        obj[colName] = cellValue;
      }
    }
    return obj;
  });

  // Compute collapsed keys
  const { collapsedKeys, keysToCollapse: actualKeysToCollapse } =
    computeCollapsedKeys(columns, keysToCollapse, objectRows);

  // Collapse the rows
  const collapsedRows = collapseRows(objectRows, actualKeysToCollapse);

  return {
    collapsedColumns: collapsedKeys,
    collapsedRows,
  };
}
