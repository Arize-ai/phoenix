export const COLUMN_BUCKETS = [
  "source",
  "input",
  "output",
  "metadata",
] as const;
export type ColumnBucket = (typeof COLUMN_BUCKETS)[number];

const OUTPUT_NAMES = new Set(["output", "reference", "expected", "original"]);
const SPLIT_NAMES = new Set(["split", "splits", "group"]);

/**
 * Auto-assigns a column to a bucket based on name matching.
 * Only "input", "output", and "metadata" are auto-assigned.
 * Everything else stays in "source".
 */
export function getAutoAssignment(columnName: string): ColumnBucket {
  const lower = columnName.toLowerCase();
  if (lower === "input") return "input";
  if (OUTPUT_NAMES.has(lower)) return "output";
  if (lower === "metadata") return "metadata";
  return "source";
}

/**
 * Returns whether a column name should be auto-assigned as a split key.
 */
export function isAutoSplitColumn(columnName: string): boolean {
  return SPLIT_NAMES.has(columnName.toLowerCase());
}
