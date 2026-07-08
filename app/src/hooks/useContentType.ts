import { useMemo } from "react";

import { isObject } from "@phoenix/typeUtils";

export type ContentType = "json" | "text";

/**
 * Determines if a value should be rendered as JSON or plain text.
 * - Objects and arrays are always treated as JSON
 * - Strings that parse as valid JSON objects/arrays are treated as JSON
 * - Everything else is treated as text
 */
function detectContentType(value: unknown): ContentType {
  // Objects and arrays are always JSON
  if (isObject(value) || Array.isArray(value)) {
    return "json";
  }

  // For strings, try to parse as JSON
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      // Only treat as JSON if the parsed result is an object or array
      // (not primitives like "true" or "123")
      if (isObject(parsed) || Array.isArray(parsed)) {
        return "json";
      }
    } catch {
      // Not valid JSON, treat as text
    }
  }

  return "text";
}

/**
 * Converts a value to a display string based on its content type.
 */
function getDisplayValue(value: unknown, contentType: ContentType): string {
  if (value == null) {
    return "";
  }

  if (contentType === "json") {
    if (typeof value === "string") {
      // It's a JSON string, parse and re-stringify for formatting
      try {
        return JSON.stringify(JSON.parse(value), null, 2);
      } catch {
        return value;
      }
    }
    // It's already an object/array
    return JSON.stringify(value, null, 2);
  }

  // For text content, just convert to string
  return String(value);
}

export interface UseContentTypeResult {
  /**
   * The detected content type: "json" or "text"
   */
  contentType: ContentType;
  /**
   * The value formatted for display (pretty-printed JSON or plain text)
   */
  displayValue: string;
}

/**
 * A hook that takes in an unknown value, detects if it should be rendered as JSON or text,
 * and returns the appropriate display value.
 *
 * This is designed to be performant with streaming content - the content type
 * detection is memoized based on a stable representation of the value.
 *
 * @param value - The value to analyze (can be any type)
 * @returns The content type and formatted display value
 */
export function useContentType(value: unknown): UseContentTypeResult {
  return useMemo(() => {
    const contentType = detectContentType(value);
    const displayValue = getDisplayValue(value, contentType);
    return { contentType, displayValue };
  }, [value]);
}
