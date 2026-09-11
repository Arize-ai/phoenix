import type { RowData } from "@tanstack/react-table";

import type { EditableTableStore } from "./editableTableStore";

/**
 * What a table passes through `table.options.meta.editing` to opt its cells
 * into editing. Cells key their edits by TanStack's `row.id`, so the table's
 * `getRowId` option must return the same ID as the store's `getRowId`.
 */
export type EditableTableMeta<Row extends object> = {
  store: EditableTableStore<Row>;
  /**
   * An extra rule for whether a cell may be edited. Rows marked for deletion
   * are never editable, whatever this returns.
   */
  isCellEditable?: (args: { row: Row; columnId: string }) => boolean;
};

declare module "@tanstack/react-table" {
  interface TableMeta<TData extends RowData> {
    editing?: EditableTableMeta<TData & object>;
  }
}
