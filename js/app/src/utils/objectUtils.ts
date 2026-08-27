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

const IDENTIFIER_SEGMENT_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*/;
const BRACKET_SEGMENT_PATTERN = /^\[(?:'((?:[^'\\]|\\.)*)'|(\d+))\]/;

/**
 * Reads a quoted bracket key back out of the notation it was written in: the
 * resolver on both sides treats a backslash as escaping the character after
 * it, so `a\'b` is the key `a'b`.
 */
export function unescapeQuotedPathKey(quotedKey: string): string {
  return quotedKey.replace(/\\(.)/g, "$1");
}

/**
 * One key of a parsed JSONPath expression, with where it sits in the
 * expression — so a caller that finds a key unresolvable can point at the
 * text that named it rather than at the whole path.
 *
 * The range covers the key's own text (`turns`, `['a.b']`, `[0]`), not the
 * separator that introduced it.
 */
export type ParsedPathSegment = {
  key: string;
  from: number;
  to: number;
};

/**
 * Splits a JSONPath expression into the keys it addresses, with their ranges.
 *
 * Covers the subset the server resolves that can also be resolved against an
 * in-memory context: dot notation (`input.query`), quoted bracket segments for
 * keys dot notation cannot express (`metadata['a.b']`), and array indices
 * (`metadata.turns[0]`).
 *
 * @returns The keys to walk, or null when the expression uses syntax only the
 *   server can resolve (wildcards, slices, negative indices, the `$` root
 *   marker), so callers can tell "cannot check here" from "resolved to
 *   undefined".
 */
export function parsePathSegmentRanges(
  path: string
): ParsedPathSegment[] | null {
  const segments: ParsedPathSegment[] = [];
  let offset = 0;
  let expectSeparator = false;

  while (offset < path.length) {
    const bracket = BRACKET_SEGMENT_PATTERN.exec(path.slice(offset));
    if (bracket) {
      const [matched, quotedKey, index] = bracket;
      segments.push({
        key:
          quotedKey === undefined ? index : unescapeQuotedPathKey(quotedKey),
        from: offset,
        to: offset + matched.length,
      });
      offset += matched.length;
      expectSeparator = true;
      continue;
    }
    if (expectSeparator) {
      if (path[offset] !== ".") {
        return null;
      }
      offset += 1;
    }
    const identifier = IDENTIFIER_SEGMENT_PATTERN.exec(path.slice(offset));
    if (!identifier) {
      return null;
    }
    segments.push({
      key: identifier[0],
      from: offset,
      to: offset + identifier[0].length,
    });
    offset += identifier[0].length;
    expectSeparator = true;
  }

  return segments;
}

/**
 * The keys {@link parsePathSegmentRanges} addresses, for callers that only
 * need to walk the path rather than point back into it.
 */
export function parsePathSegments(path: string): string[] | null {
  return parsePathSegmentRanges(path)?.map((segment) => segment.key) ?? null;
}

/**
 * Get a value from an object using a JSONPath expression.
 *
 * Resolves the same subset {@link parsePathSegments} covers, so a path built
 * from the mapping source reads the same value here that the server reads at
 * evaluation time.
 *
 * @param obj - The object to retrieve the value from
 * @param path - JSONPath expression (e.g., "input", "input.query",
 *   "metadata['a.b']")
 * @returns The value at the path, or undefined if not found or not resolvable
 *   client-side
 */
export function getValueAtPath(obj: unknown, path: string): unknown {
  if (!path || !isStringKeyedObject(obj)) {
    return obj;
  }

  const segments = parsePathSegments(path);
  if (segments === null) {
    return undefined;
  }

  let current: unknown = obj;

  for (const segment of segments) {
    if (!isStringKeyedObject(current)) {
      return undefined;
    }
    current = current[segment];
  }

  return current;
}

/**
 * Recursively extracts all paths from an object.
 *
 * For nested objects, generates dot-notation paths.
 * For arrays, generates indexed paths like "items[0]".
 *
 * @param obj - The object to extract paths from
 * @param prefix - Optional prefix for the current path level
 * @param maxDepth - Maximum depth to traverse (default: 10)
 * @returns An array of all paths in the object
 *
 * @example
 * extractPathsFromObject({ user: { name: "Alice", tags: ["a", "b"] } })
 * // Returns: ["user", "user.name", "user.tags", "user.tags[0]", "user.tags[1]"]
 */
export function extractPathsFromObject(
  obj: unknown,
  prefix = "",
  maxDepth = 10
): string[] {
  if (maxDepth <= 0) {
    return prefix ? [prefix] : [];
  }

  const paths: string[] = [];

  if (Array.isArray(obj)) {
    // For arrays, add paths for each element
    obj.forEach((item, index) => {
      const arrayPath = `${prefix}[${index}]`;
      paths.push(arrayPath);
      if (isStringKeyedObject(item) || Array.isArray(item)) {
        paths.push(...extractPathsFromObject(item, arrayPath, maxDepth - 1));
      }
    });
  } else if (isStringKeyedObject(obj)) {
    // For objects, add paths for each key
    for (const key of Object.keys(obj)) {
      const currentPath = prefix ? `${prefix}.${key}` : key;
      paths.push(currentPath);
      const value = obj[key];
      if (isStringKeyedObject(value) || Array.isArray(value)) {
        paths.push(...extractPathsFromObject(value, currentPath, maxDepth - 1));
      }
    }
  }

  return paths;
}

/**
 * Extracts all unique paths from multiple dataset examples.
 *
 * @param examples - Array of dataset examples to extract paths from
 * @param templateVariablesPath - Optional path prefix that scopes the variables.
 *   When set (e.g., "input"), paths are extracted relative to that prefix.
 *   When null/empty, paths are extracted from the full context (input, reference, metadata).
 * @param maxExamples - Maximum number of examples to process (to limit computation)
 * @returns A deduplicated array of all paths found across examples
 */
export function extractPathsFromDatasetExamples(
  examples: Array<{
    input: unknown;
    taskOutput?: unknown;
    metadata: unknown;
    reference?: unknown;
  }>,
  templateVariablesPath: string | null | undefined,
  maxExamples = 10
): string[] {
  const allPaths = new Set<string>();

  // Process only up to maxExamples to limit computation
  const examplesToProcess = examples.slice(0, maxExamples);

  for (const example of examplesToProcess) {
    // Build the template variables context matching the backend mapping
    // when processing template contexts in the playground and evaluators:
    // - reference is the output field of an example
    // - output is the task output field, this does not exist on a dataset example
    const templateContext: Record<string, unknown> = {
      input: example.input,
      metadata: example.metadata,
      ...(example.taskOutput != null ? { output: example.taskOutput } : {}),
      ...(Object.hasOwn(example, "reference")
        ? { reference: example.reference }
        : {}),
    };

    // Determine the target object based on templateVariablesPath
    let targetObject: unknown;
    if (templateVariablesPath) {
      // Get the scoped object (e.g., if path is "input", get templateContext.input)
      targetObject = getValueAtPath(templateContext, templateVariablesPath);
    } else {
      // No path prefix - use full context
      targetObject = templateContext;
    }

    if (targetObject != null) {
      const paths = extractPathsFromObject(targetObject);
      for (const path of paths) {
        allPaths.add(path);
      }
    }
  }

  // Sort paths alphabetically for consistent ordering
  return Array.from(allPaths).sort();
}
