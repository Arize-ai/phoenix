import { useMemo } from "react";

import {
  UnnestResult,
  unnestSingleStringValue,
} from "@phoenix/utils/jsonUtils";

/**
 * Unnests a JSON value if it's an object with a single string key whose value is a string.
 * This is useful for displaying wrapped responses like `{"response": "..."}` as just the string content.
 *
 * @returns An object with the unnested value and whether unnesting occurred.
 *
 * @example
 * // Returns { value: "Hello world", wasUnnested: true }
 * useUnnestedValue({ "response": "Hello world" })
 *
 * @example
 * // Returns { value: { "a": "1", "b": "2" }, wasUnnested: false }
 * useUnnestedValue({ "a": "1", "b": "2" })
 *
 * @example
 * // Returns { value: { "data": { "nested": true } }, wasUnnested: false }
 * useUnnestedValue({ "data": { "nested": true } })
 */
export function useUnnestedValue(value: unknown): UnnestResult {
  return useMemo(() => unnestSingleStringValue(value), [value]);
}
