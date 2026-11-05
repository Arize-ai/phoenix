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

/**
 * True when a preview value of `column` is a Phoenix DatasetExample node ID,
 * as in the `id` column of a Phoenix CSV/JSONL export. The server rejects
 * those IDs when creating a new dataset (422), so create mode must not
 * auto-select such a column as the Example ID.
 * Only the preview rows are checked: a column whose node IDs start after
 * the preview still gets auto-selected (the server's 422 detail then says why).
 */
function holdsDatasetExampleIds({
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
 * Auto-assign columns based on name matching heuristics. In create mode an
 * ID-named column holding DatasetExample node IDs is not auto-selected.
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
    if (
      isAutoIdColumn(column) &&
      !(
        mode === "create" &&
        holdsDatasetExampleIds({ column, columns, rows: previewRows })
      )
    ) {
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
