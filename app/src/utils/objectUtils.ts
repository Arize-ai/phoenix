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
 * Get a value from an object using a dot-notation path.
 *
 * TODO: Replace this with a JSON path-based utility (e.g., using jsonpath-plus
 * or similar library) to support full JSON path syntax like:
 * - $.input.query
 * - $.metadata.tags[0]
 * - $..nested.field
 *
 * @param obj - The object to retrieve the value from
 * @param path - Dot-notation path (e.g., "input", "input.query")
 * @returns The value at the path, or undefined if not found
 */
export function getValueAtPath(obj: unknown, path: string): unknown {
  if (!path || !isStringKeyedObject(obj)) {
    return obj;
  }

  const segments = path.split(".");
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
  examples: Array<{ input: unknown; output: unknown; metadata: unknown }>,
  templateVariablesPath: string | null | undefined,
  maxExamples = 10
): string[] {
  const allPaths = new Set<string>();

  // Process only up to maxExamples to limit computation
  const examplesToProcess = examples.slice(0, maxExamples);

  for (const example of examplesToProcess) {
    // Build the template variables context matching the backend mapping
    // (output is renamed to reference)
    const templateContext: Record<string, unknown> = {
      input: example.input,
      reference: example.output,
      metadata: example.metadata,
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
