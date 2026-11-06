import { isGlobalIdOfType } from "@phoenix/utils/globalIdUtils";

import type { ColumnAssignerValue } from "./ColumnAssigner";
import {
  getAutoAssignment,
  isAutoIdColumn,
  isAutoSplitColumn,
} from "./constants";

/** Preview rows of an uploaded file: CSV rows or parsed JSONL objects. */
export type PreviewData = string[][] | Record<string, unknown>[];

export type AutoAssignmentResult = ColumnAssignerValue & {
  splitKey: string | null;
  exampleIdKey: string | null;
};

function holdsDatasetExampleNodeIds({
  column,
  columns,
  rows,
}: {
  column: string;
  columns: string[];
  rows: PreviewData;
}): boolean {
  const index = columns.indexOf(column);
  return rows.some((row) => {
    const value = Array.isArray(row) ? row[index] : row[column];
    return (
      typeof value === "string" && isGlobalIdOfType(value, "DatasetExample")
    );
  });
}

/**
 * Node IDs name examples of an existing dataset, which a new dataset cannot
 * contain, so an exported `id` column is left unselected in create mode.
 */
function isAutoExampleIdColumn({
  column,
  columns,
  rows,
  mode,
}: {
  column: string;
  columns: string[];
  rows: PreviewData;
  mode: "create" | "append";
}): boolean {
  if (!isAutoIdColumn(column)) {
    return false;
  }
  return (
    mode === "append" || !holdsDatasetExampleNodeIds({ column, columns, rows })
  );
}

/**
 * Auto-assign columns based on name matching heuristics.
 */
export function computeAutoAssignment({
  columns,
  previewRows,
  mode,
}: {
  columns: string[];
  previewRows: PreviewData;
  mode: "create" | "append";
}): AutoAssignmentResult {
  const result: AutoAssignmentResult = {
    input: [],
    output: [],
    metadata: [],
    splitKey: null,
    exampleIdKey: null,
  };
  for (const column of columns) {
    if (isAutoSplitColumn(column)) {
      result.splitKey ??= column; // first match wins
    }
    if (isAutoExampleIdColumn({ column, columns, rows: previewRows, mode })) {
      result.exampleIdKey ??= column; // first match wins
    }
    const bucket = getAutoAssignment(column);
    if (bucket === "input") {
      result.input.push(column);
    } else if (bucket === "output") {
      result.output.push(column);
    } else if (bucket === "metadata") {
      result.metadata.push(column);
    }
  }
  return result;
}
