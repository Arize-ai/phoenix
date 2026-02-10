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

export function isJSONObjectString(str: string) {
  return isJSONString({ str, excludeArray: true, excludePrimitives: true });
}

export function safelyParseJSON(str: string) {
  try {
    return { json: JSON.parse(str) };
  } catch (e) {
    return { json: null, parseError: e };
  }
}

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
function flattenObject(
  obj: object,
  parentKey: string = "",
  separator: string = "."
): Record<string, string | boolean | number> {
  const result: Record<string, string | boolean | number> = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = parentKey ? `${parentKey}${separator}${key}` : key;

    if (value && typeof value === "object") {
      Object.assign(result, flattenObject(value, newKey, separator));
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
    return flattenObject(parsedObj, "", separator);
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
