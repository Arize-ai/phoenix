import { isPlainObject } from "@phoenix/utils/jsonUtils";

// ============================================================================
// Collapse Utilities
// Used for "collapsing" top-level keys during dataset upload, promoting their
// immediate children to become top-level keys.
// ============================================================================

/**
 * Result of computing collapse conflicts.
 */
export type BucketCollapseConflictsResult = {
  /**
   * Keys that can be collapsed.
   */
  keysToCollapse: string[];
  /**
   * Keys that cannot be collapsed due to assignment-local conflicts.
   * Maps the parent key to the conflicting emitted keys.
   */
  conflicts: Map<string, string[]>;
};

/**
 * Computes which assigned parents can be flattened within their selected bucket.
 *
 * Conflicts are only checked against other selected keys in the same bucket.
 * Unused source keys do not block flattening.
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
  const conflicts = new Map<string, string[]>();
  const keysToCollapse: string[] = [];
  const childKeysByParent = new Map<string, string[]>();

  for (const parentKey of collapsibleKeys) {
    const childKeys = new Set<string>();
    for (const row of previewRows) {
      const value = row[parentKey];
      if (!isPlainObject(value)) {
        conflicts.set(parentKey, ["non-object preview value"]);
        childKeys.clear();
        break;
      }
      for (const childKey of Object.keys(value)) {
        childKeys.add(childKey);
      }
    }
    if (!conflicts.has(parentKey)) {
      childKeysByParent.set(parentKey, [...childKeys]);
    }
  }

  for (const bucketKeys of Object.values(bucketAssignments)) {
    const selectedKeys = new Set(bucketKeys);
    const selectedParents = bucketKeys.filter((key) =>
      childKeysByParent.has(key)
    );
    const emittedKeys = new Map<string, string>();

    for (const key of bucketKeys) {
      if (!childKeysByParent.has(key)) {
        emittedKeys.set(key, key);
      }
    }

    for (const parentKey of selectedParents) {
      const childKeys = childKeysByParent.get(parentKey) ?? [];
      const keyConflicts: string[] = [];

      for (const childKey of childKeys) {
        const existingKey = emittedKeys.get(childKey);
        if (existingKey && existingKey !== parentKey) {
          keyConflicts.push(childKey);
          continue;
        }
        if (selectedKeys.has(childKey)) {
          keyConflicts.push(childKey);
        }
      }

      if (keyConflicts.length > 0) {
        conflicts.set(parentKey, [...new Set(keyConflicts)]);
      } else {
        if (!keysToCollapse.includes(parentKey)) {
          keysToCollapse.push(parentKey);
        }
        for (const childKey of childKeys) {
          emittedKeys.set(childKey, parentKey);
        }
      }
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
  keysToCollapse: ReadonlySet<string> | readonly string[]
): Record<string, unknown> {
  const keysToCollapseSet =
    keysToCollapse instanceof Set ? keysToCollapse : new Set(keysToCollapse);
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
