import { isPlainObject, safelyParseJSONString } from "@phoenix/utils/jsonUtils";

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
 * Result of computing bucket-aware collapse conflicts.
 */
export type BucketCollapseConflictsResult = {
  /**
   * Keys that can be collapsed (no conflicts within their assigned bucket).
   */
  keysToCollapse: string[];
  /**
   * Keys that cannot be collapsed due to conflicts within their assigned bucket.
   * Maps the parent key to the list of conflicting child keys.
   */
  conflicts: Map<string, string[]>;
};

/**
 * Computes which collapsible keys can actually be collapsed based on bucket assignments.
 *
 * A conflict only occurs when two keys assigned to the SAME bucket would produce
 * the same child key when collapsed. Keys in different buckets don't conflict.
 *
 * @param collapsibleKeys - Keys that have object values and can potentially be collapsed
 * @param bucketAssignments - Map of bucket name to assigned keys
 * @param previewRows - Sample data rows used to extract child keys
 * @returns The keys that can be collapsed and any conflicts
 */
export function computeBucketCollapseConflicts(
  collapsibleKeys: string[],
  bucketAssignments: {
    input: string[];
    output: string[];
    metadata: string[];
  },
  previewRows: Record<string, unknown>[]
): BucketCollapseConflictsResult {
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

  const conflicts = new Map<string, string[]>();
  const keysToCollapse: string[] = [];
  const collapsibleKeysSet = new Set(collapsibleKeys);

  // Check conflicts within each bucket separately
  for (const [, bucketKeys] of Object.entries(bucketAssignments)) {
    // Only consider collapsible keys that are assigned to this bucket
    const collapsibleInBucket = bucketKeys.filter((k) =>
      collapsibleKeysSet.has(k)
    );
    const nonCollapsibleInBucket = bucketKeys.filter(
      (k) => !collapsibleKeysSet.has(k)
    );

    // Track child keys we've seen in this bucket
    const seenChildKeysInBucket = new Map<string, string>(); // childKey -> parentKey

    for (const parentKey of collapsibleInBucket) {
      const childKeys = childKeysByParent.get(parentKey) || new Set();
      const parentConflicts: string[] = [];

      for (const childKey of childKeys) {
        // Check conflict with non-collapsible keys in same bucket
        if (nonCollapsibleInBucket.includes(childKey)) {
          parentConflicts.push(childKey);
          continue;
        }
        // Check conflict with another collapsible key in same bucket
        // (the parent key itself, not its children)
        if (collapsibleInBucket.includes(childKey) && childKey !== parentKey) {
          parentConflicts.push(childKey);
          continue;
        }
        // Check conflict with another parent's children in same bucket
        const existingParent = seenChildKeysInBucket.get(childKey);
        if (existingParent && existingParent !== parentKey) {
          parentConflicts.push(childKey);
          continue;
        }
      }

      if (parentConflicts.length > 0) {
        // Merge with any existing conflicts for this key
        const existing = conflicts.get(parentKey) || [];
        conflicts.set(parentKey, [
          ...new Set([...existing, ...parentConflicts]),
        ]);
      } else {
        // No conflicts in this bucket - register child keys
        for (const childKey of childKeys) {
          seenChildKeysInBucket.set(childKey, parentKey);
        }
      }
    }
  }

  // Keys to collapse are collapsible keys that have no conflicts
  for (const key of collapsibleKeys) {
    if (!conflicts.has(key)) {
      keysToCollapse.push(key);
    }
  }

  return {
    keysToCollapse,
    conflicts,
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
