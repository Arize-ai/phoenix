import { useMemo } from "react";

import { isStringKeyedObject } from "@phoenix/typeUtils";

/**
 * Unnests a JSON value if it's an object with a single string key whose value is a string.
 * This is useful for displaying wrapped responses like `{"response": "..."}` as just the string content.
 *
 * @example
 * // Returns "Hello world"
 * useUnnestedValue({ "response": "Hello world" })
 *
 * @example
 * // Returns the original object (multiple keys)
 * useUnnestedValue({ "a": "1", "b": "2" })
 *
 * @example
 * // Returns the original object (nested value is not a string)
 * useUnnestedValue({ "data": { "nested": true } })
 */
export function useUnnestedValue(value: unknown): unknown {
  return useMemo(() => {
    if (!isStringKeyedObject(value)) {
      return value;
    }

    const keys = Object.keys(value);

    // Only unnest if there's exactly one key
    if (keys.length !== 1) {
      return value;
    }

    const singleValue = value[keys[0]];

    // Only unnest if the value is a string
    if (typeof singleValue !== "string") {
      return value;
    }

    return singleValue;
  }, [value]);
}
