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
    /**
     * The width, in pixels, a loaded cell's content usually takes, for a
     * column whose content runs well short of its size (a switch, a badge, a
     * short number). A `TableBodySkeleton` holds this much in the column so
     * the column lays out at its loaded width. Defaults to most of the
     * column's size.
     */
    skeletonWidth?: number;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableMeta<TFeatures extends TableFeatures, TData extends RowData> {
    /** Opts the table's cells into editing. See `EditableTableMeta`. */
    editing?: EditableTableMeta<TData & object>;
  }
}
