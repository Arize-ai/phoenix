export const COLUMN_BUCKETS = [
  "source",
  "input",
  "output",
  "metadata",
] as const;
export type ColumnBucket = (typeof COLUMN_BUCKETS)[number];

/**
 * Auto-assigns a column to a bucket based on exact name match.
 * Only "input", "output", and "metadata" are auto-assigned.
 * Everything else stays in "source".
 */
export function getAutoAssignment(columnName: string): ColumnBucket {
  const lower = columnName.toLowerCase();
  if (lower === "input") return "input";
  if (lower === "output") return "output";
  if (lower === "metadata") return "metadata";
  return "source";
}
