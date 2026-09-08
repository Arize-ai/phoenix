import isEqual from "lodash/isEqual";
import type { StoreApi } from "zustand";
import { createStore } from "zustand";

export type EditableTableMode = "read" | "editing" | "saving";

export type EditableTableDiff<Row extends object> = {
  addedRows: Row[];
  updatedRows: Array<{
    rowId: string;
    changes: Partial<Row>;
  }>;
  deletedRowIds: string[];
};

type EditableTableUpdatedRows<Row extends object> = Partial<
  Record<string, Partial<Row> | undefined>
>;

export type EditableTableStoreState<Row extends object> = {
  mode: EditableTableMode;
  addedRows: Row[];
  addedRowIds: Set<string>;
  updatedRows: EditableTableUpdatedRows<Row>;
  deletedRowIds: Set<string>;
  beginEditing: () => void;
  cancelEditing: () => void;
  startSaving: () => void;
  stopSaving: () => void;
  finishSaving: () => void;
  addRow: (row: Row) => void;
  deleteRow: (rowId: string) => void;
  restoreRow: (rowId: string) => void;
  updateCell: <ColumnId extends keyof Row & string>(args: {
    rowId: string;
    columnId: ColumnId;
    value: Row[ColumnId];
    originalValue: Row[ColumnId];
  }) => void;
  getDiff: () => EditableTableDiff<Row>;
};

export type EditableTableStore<Row extends object> = StoreApi<
  EditableTableStoreState<Row>
>;

export type CreateEditableTableStoreOptions<Row extends object> = {
  getRowId: (row: Row) => string;
  areValuesEqual?: (left: unknown, right: unknown) => boolean;
};

/**
 * The pristine edit state. Built fresh on every reset so no two stores — and
 * no two editing sessions — ever share a collection instance.
 */
const createEmptyEditState = <Row extends object>() => ({
  mode: "read" as const,
  addedRows: [] as Row[],
  addedRowIds: new Set<string>(),
  updatedRows: {} as EditableTableUpdatedRows<Row>,
  deletedRowIds: new Set<string>(),
});

/**
 * Creates a table-scoped sparse edit store.
 *
 * Server rows remain outside this store. Only additions, changed cells, and
 * deletions are retained here.
 */
export function createEditableTableStore<Row extends object>({
  getRowId,
  areValuesEqual = isEqual,
}: CreateEditableTableStoreOptions<Row>): EditableTableStore<Row> {
  return createStore<EditableTableStoreState<Row>>()((set, get) => {
    // Ending a session — whether the changes were discarded or committed — drops
    // every pending change and returns the table to read mode.
    const endSession = () => {
      set(createEmptyEditState<Row>());
    };
    return {
      ...createEmptyEditState<Row>(),
      beginEditing: () => {
        set({ mode: "editing" });
      },
      cancelEditing: endSession,
      startSaving: () => {
        set({ mode: "saving" });
      },
      stopSaving: () => {
        set({ mode: "editing" });
      },
      finishSaving: endSession,
      addRow: (row) => {
        const rowId = getRowId(row);
        set((state) => {
          if (state.addedRowIds.has(rowId)) {
            return state;
          }
          const addedRowIds = new Set(state.addedRowIds);
          addedRowIds.add(rowId);
          return {
            addedRows: [row, ...state.addedRows],
            addedRowIds,
          };
        });
      },
      deleteRow: (rowId) => {
        set((state) => {
          if (state.addedRowIds.has(rowId)) {
            const addedRowIds = new Set(state.addedRowIds);
            addedRowIds.delete(rowId);
            return {
              addedRows: state.addedRows.filter(
                (addedRow) => getRowId(addedRow) !== rowId
              ),
              addedRowIds,
            };
          }
          const deletedRowIds = new Set(state.deletedRowIds);
          deletedRowIds.add(rowId);
          return { deletedRowIds };
        });
      },
      restoreRow: (rowId) => {
        set((state) => {
          if (!state.deletedRowIds.has(rowId)) {
            return state;
          }
          const deletedRowIds = new Set(state.deletedRowIds);
          deletedRowIds.delete(rowId);
          return { deletedRowIds };
        });
      },
      updateCell: ({ rowId, columnId, value, originalValue }) => {
        set((state) => {
          if (state.addedRowIds.has(rowId)) {
            const addedRowIndex = state.addedRows.findIndex(
              (addedRow) => getRowId(addedRow) === rowId
            );
            if (addedRowIndex === -1) {
              return state;
            }
            const addedRows = [...state.addedRows];
            addedRows[addedRowIndex] = {
              ...addedRows[addedRowIndex],
              [columnId]: value,
            };
            return { addedRows };
          }

          const updatedRows = { ...state.updatedRows };
          const rowChanges: Partial<Row> = { ...updatedRows[rowId] };
          if (areValuesEqual(value, originalValue)) {
            delete rowChanges[columnId];
          } else {
            rowChanges[columnId] = value;
          }
          if (Object.keys(rowChanges).length === 0) {
            delete updatedRows[rowId];
          } else {
            updatedRows[rowId] = rowChanges;
          }
          return { updatedRows };
        });
      },
      getDiff: () => {
        const state = get();
        const updatedRows = Object.entries(state.updatedRows)
          .filter(
            (entry): entry is [string, Partial<Row>] =>
              entry[1] !== undefined && !state.deletedRowIds.has(entry[0])
          )
          .map(([rowId, changes]) => ({ rowId, changes }));
        return {
          addedRows: state.addedRows,
          updatedRows,
          deletedRowIds: [...state.deletedRowIds],
        };
      },
    };
  });
}

export function getEditableTableCellValue<
  Row extends object,
  ColumnId extends keyof Row & string,
>({
  state,
  rowId,
  columnId,
  originalValue,
}: {
  state: EditableTableStoreState<Row>;
  rowId: string;
  columnId: ColumnId;
  originalValue: Row[ColumnId];
}): Row[ColumnId] {
  const rowChanges = state.updatedRows[rowId];
  return rowChanges && Object.hasOwn(rowChanges, columnId)
    ? (rowChanges[columnId] as Row[ColumnId])
    : originalValue;
}

export type EditableTableChangeCounts = {
  added: number;
  updated: number;
  deleted: number;
};

export function getEditableTableChangeCounts<Row extends object>(
  state: EditableTableStoreState<Row>
): EditableTableChangeCounts {
  const updated = Object.keys(state.updatedRows).filter(
    (rowId) => !state.deletedRowIds.has(rowId)
  ).length;
  return {
    added: state.addedRows.length,
    updated,
    deleted: state.deletedRowIds.size,
  };
}

export function getEditableTableChangeCount<Row extends object>(
  state: EditableTableStoreState<Row>
): number {
  const { added, updated, deleted } = getEditableTableChangeCounts(state);
  return added + updated + deleted;
}
