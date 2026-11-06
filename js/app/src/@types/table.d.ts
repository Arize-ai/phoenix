import type { EditableTableMeta } from "@phoenix/types/table";

import "@tanstack/react-table";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<
    TFeatures extends TableFeatures,
    TData extends RowData,
    TValue extends CellData = CellData,
  > {
    textAlign: "left" | "center" | "right";
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableMeta<TFeatures extends TableFeatures, TData extends RowData> {
    /** Opts the table's cells into editing. See `EditableTableMeta`. */
    editing?: EditableTableMeta<TData & object>;
  }
}
