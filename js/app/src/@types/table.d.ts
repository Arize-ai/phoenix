import type { EditableTableMeta } from "@phoenix/types/table";

import "@tanstack/react-table";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    textAlign: "left" | "center" | "right";
  }

  interface TableMeta<TData extends RowData> {
    /** Opts the table's cells into editing. See `EditableTableMeta`. */
    editing?: EditableTableMeta<TData & object>;
  }
}
