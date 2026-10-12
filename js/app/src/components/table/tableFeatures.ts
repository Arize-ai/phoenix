import type * as TanStack from "@tanstack/react-table";
import {
  columnFilteringFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createExpandedRowModel,
  createFilteredRowModel,
  createSortedRowModel,
  globalFilteringFeature,
  rowExpandingFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
} from "@tanstack/react-table";

/**
 * The TanStack Table features every table in the app is built with.
 *
 * TanStack types a table's rows, columns, headers and cells by the features it
 * was built with, and a header from one feature set can't be handed to a
 * component typed for another. Sharing one set lets the components in this
 * directory take any table's headers, columns and rows.
 *
 * The client-side row models (sorting, filtering, expanding) are always
 * registered. A table whose rows arrive already sorted or expanded from the
 * server opts out with `manualSorting` / `manualExpanding`.
 */
export const appTableFeatures = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnSizingFeature,
  columnResizingFeature,
  columnVisibilityFeature,
  rowExpandingFeature,
  rowSelectionFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  expandedRowModel: createExpandedRowModel(),
  // the functions a column's `sortFn: "auto"` (the default) can pick from
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
});

export type AppTableFeatures = typeof appTableFeatures;

/*
 * TanStack's types with the app's features bound, taking the same parameters
 * TanStack v8's did.
 */
export type ColumnDef<
  TData extends TanStack.RowData,
  TValue extends TanStack.CellData = TanStack.CellData,
> = TanStack.ColumnDef<AppTableFeatures, TData, TValue>;
export type Column<
  TData extends TanStack.RowData,
  TValue extends TanStack.CellData = TanStack.CellData,
> = TanStack.Column<AppTableFeatures, TData, TValue>;
export type Header<
  TData extends TanStack.RowData,
  TValue extends TanStack.CellData = TanStack.CellData,
> = TanStack.Header<AppTableFeatures, TData, TValue>;
export type Cell<
  TData extends TanStack.RowData,
  TValue extends TanStack.CellData = TanStack.CellData,
> = TanStack.Cell<AppTableFeatures, TData, TValue>;
export type CellContext<
  TData extends TanStack.RowData,
  TValue extends TanStack.CellData = TanStack.CellData,
> = TanStack.CellContext<AppTableFeatures, TData, TValue>;
export type HeaderContext<
  TData extends TanStack.RowData,
  TValue extends TanStack.CellData = TanStack.CellData,
> = TanStack.HeaderContext<AppTableFeatures, TData, TValue>;
export type Row<TData extends TanStack.RowData> = TanStack.Row<
  AppTableFeatures,
  TData
>;
export type Table<TData extends TanStack.RowData> = TanStack.Table<
  AppTableFeatures,
  TData
>;
