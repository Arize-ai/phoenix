import type { CellContext } from "@tanstack/react-table";
import { useStore } from "zustand";

import { getEditableTableCellValue } from "./editableTableStore";

/**
 * One cell's view of the edit store: its current value, whether it may be
 * edited, and the actions to change or revert it. Cell renderers build on this
 * so every editor shares one definition of "dirty" and "editable".
 */
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
  const rowId = context.row.id;
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
  const isAddedRow = useStore(editing.store, (state) =>
    state.addedRowIds.has(rowId)
  );
  const isDeletedRow = useStore(editing.store, (state) =>
    state.deletedRowIds.has(rowId)
  );
  // The cell holds a pending edit that can be dropped to restore its original
  // value.
  const canRevert = useStore(editing.store, (state) =>
    Object.hasOwn(state.updatedRows[rowId] ?? {}, columnId)
  );
  // Every cell of a new row is dirty: the whole row is pending.
  const isDirty = isAddedRow || canRevert;
  const isEditable =
    !isDeletedRow &&
    (editing.isCellEditable?.({
      row: context.row.original,
      columnId,
    }) ??
      true);

  return {
    value,
    originalValue,
    isDirty,
    canRevert,
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
    // Drops the pending change so the cell reads its original value again.
    revertValue: () => {
      editing.store.getState().updateCell({
        rowId,
        columnId,
        value: originalValue,
        originalValue,
      });
    },
  };
}
