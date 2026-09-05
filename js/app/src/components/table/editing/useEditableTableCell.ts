import type { CellContext } from "@tanstack/react-table";
import { useStore } from "zustand";

import { getEditableTableCellValue } from "./editableTableStore";

export function useEditableTableCell<
  Row extends object,
  ColumnId extends keyof Row & string,
>({
  context,
  columnId,
}: {
  context: CellContext<Row, unknown>;
  columnId: ColumnId;
}) {
  const editing = context.table.options.meta?.editing;
  if (!editing) {
    throw new Error(
      "Editable table cells require table.options.meta.editing to be configured"
    );
  }
  const rowId = editing.getRowId(context.row.original);
  const originalValue = context.getValue() as Row[ColumnId];
  const mode = useStore(editing.store, (state) => state.mode);
  const value = useStore(editing.store, (state) =>
    getEditableTableCellValue({
      state,
      rowId,
      columnId,
      originalValue,
    })
  );
  const isDirty = useStore(editing.store, (state) => {
    return (
      state.addedRowIds.has(rowId) ||
      Object.hasOwn(state.updatedRows[rowId] ?? {}, columnId)
    );
  });
  const isEditable =
    editing.isCellEditable?.({
      row: context.row.original,
      columnId,
    }) ?? true;

  return {
    value,
    isDirty,
    isEditable,
    isEditing: mode !== "read",
    isSaving: mode === "saving",
    updateValue: (nextValue: Row[ColumnId]) => {
      editing.store.getState().updateCell({
        rowId,
        columnId,
        value: nextValue,
        originalValue,
      });
    },
  };
}
