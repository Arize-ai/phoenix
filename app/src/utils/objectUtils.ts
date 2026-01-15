import { isStringKeyedObject } from "@phoenix/typeUtils";

/**
 * Removes null, undefined, empty strings, empty objects, and empty arrays from an object.
 * Returns undefined if the resulting object would be empty.
 *
 * Used to build compact GraphQL mutation inputs that only include defined values.
 *
 * @returns A partial version of the input object with empty values removed,
 *          or undefined if all values were empty.
 *
 * @remarks
 * The return type is `Partial<T> | undefined` which provides better type safety
 * than `any` while still being compatible with GraphQL mutation inputs.
 * The GraphQL schema enforces required fields at the server layer, and
 * Zod validation ensures required fields are present before submission.
 */
export function compressObject<T extends Record<string, unknown>>(
  obj: T
): Partial<T> | undefined {
  const entries = Object.entries(obj).filter(([, value]) => {
    if (value === null || value === undefined) return false;
    if (value === "") return false;
    if (typeof value === "object" && !Array.isArray(value)) {
      return Object.keys(value).length > 0;
    }
    if (Array.isArray(value)) return value.length > 0;
    return true;
  });

  if (entries.length === 0) return undefined;

  return Object.fromEntries(entries) as Partial<T>;
}

/**
 * Get a value from an object using a dot-notation path with optional array indexing.
 *
 * Supports paths like:
 * - "input" -> simple key access
 * - "input.query" -> nested key access
 * - "messages[0]" -> array index access
 * - "input.messages[0].content" -> combined access
 *
 * @param obj - The object to retrieve the value from
 * @param path - Dot-notation path with optional array indexing (e.g., "input.messages[0].content")
 * @returns The value at the path, or undefined if not found
 */
export function getValueAtPath(obj: unknown, path: string): unknown {
  if (!path) {
    return obj;
  }

  // Parse the path into segments, handling both dots and brackets
  const segments: string[] = [];
  let currentSegment = "";
  let i = 0;

  while (i < path.length) {
    const char = path[i];
    if (char === ".") {
      if (currentSegment) {
        segments.push(currentSegment);
        currentSegment = "";
      }
    } else if (char === "[") {
      if (currentSegment) {
        segments.push(currentSegment);
        currentSegment = "";
      }
      // Find the closing bracket
      const bracketEnd = path.indexOf("]", i);
      if (bracketEnd === -1) {
        // Malformed path, return undefined
        return undefined;
      }
      segments.push(path.slice(i, bracketEnd + 1));
      i = bracketEnd;
    } else {
      currentSegment += char;
    }
    i++;
  }

  if (currentSegment) {
    segments.push(currentSegment);
  }

  // Traverse the path
  let current: unknown = obj;

  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (segment.startsWith("[") && segment.endsWith("]")) {
      // Array index access
      const indexStr = segment.slice(1, -1);
      const index = parseInt(indexStr, 10);
      if (isNaN(index)) {
        return undefined;
      }
      if (!Array.isArray(current)) {
        return undefined;
      }
      current = current[index];
    } else {
      // Dictionary key access
      if (!isStringKeyedObject(current)) {
        return undefined;
      }
      current = current[segment];
    }
  }

  return current;
}

/**
 * Extract the root key from a path expression.
 *
 * Examples:
 * - "input" -> "input"
 * - "input.query" -> "input"
 * - "messages[0]" -> "messages"
 * - "input.messages[0].content" -> "input"
 */
export function getRootKey(path: string): string {
  // Find the first delimiter (dot or bracket)
  const dotPos = path.indexOf(".");
  const bracketPos = path.indexOf("[");

  if (dotPos === -1 && bracketPos === -1) {
    return path;
  } else if (dotPos === -1) {
    return path.slice(0, bracketPos);
  } else if (bracketPos === -1) {
    return path.slice(0, dotPos);
  } else {
    return path.slice(0, Math.min(dotPos, bracketPos));
  }
}
