import type { RowData } from "@tanstack/react-table";

import type { EditableTableStore } from "./editableTableStore";

export type EditableTableMeta<Row extends object> = {
  store: EditableTableStore<Row>;
  getRowId: (row: Row) => string;
  isCellEditable?: (args: { row: Row; columnId: string }) => boolean;
};

declare module "@tanstack/react-table" {
  interface TableMeta<TData extends RowData> {
    editing?: EditableTableMeta<TData & object>;
  }
}
