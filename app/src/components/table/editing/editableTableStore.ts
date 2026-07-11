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

type EditableTableCellErrors<Row extends object> = Partial<
  Record<string, Partial<Record<keyof Row & string, string | undefined>>>
>;

type EditableTableUpdatedRows<Row extends object> = Partial<
  Record<string, Partial<Row> | undefined>
>;

export type EditableTableStoreState<Row extends object> = {
  mode: EditableTableMode;
  addedRows: Row[];
  addedRowIds: Set<string>;
  updatedRows: EditableTableUpdatedRows<Row>;
  deletedRowIds: Set<string>;
  cellErrors: EditableTableCellErrors<Row>;
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
  setCellError: (args: {
    rowId: string;
    columnId: keyof Row & string;
    error: string | null;
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
  cellErrors: {} as EditableTableCellErrors<Row>,
});

/**
 * Creates a table-scoped sparse edit store.
 *
 * Server rows remain outside this store. Only additions, changed cells,
 * deletions, and validation errors are retained here.
 */
export function createEditableTableStore<Row extends object>({
  getRowId,
  areValuesEqual = isEqual,
}: CreateEditableTableStoreOptions<Row>): EditableTableStore<Row> {
  return createStore<EditableTableStoreState<Row>>()((set, get) => ({
    ...createEmptyEditState<Row>(),
    beginEditing: () => {
      set({ mode: "editing" });
    },
    cancelEditing: () => {
      set(createEmptyEditState<Row>());
    },
    startSaving: () => {
      set({ mode: "saving" });
    },
    stopSaving: () => {
      set({ mode: "editing" });
    },
    finishSaving: () => {
      set(createEmptyEditState<Row>());
    },
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
          // The row ceases to exist, so its validation errors go with it.
          const cellErrors = { ...state.cellErrors };
          delete cellErrors[rowId];
          return {
            addedRows: state.addedRows.filter(
              (addedRow) => getRowId(addedRow) !== rowId
            ),
            addedRowIds,
            cellErrors,
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
    setCellError: ({ rowId, columnId, error }) => {
      set((state) => {
        const cellErrors = { ...state.cellErrors };
        const rowErrors: Partial<
          Record<keyof Row & string, string | undefined>
        > = { ...cellErrors[rowId] };
        if (error === null) {
          delete rowErrors[columnId];
        } else {
          rowErrors[columnId] = error;
        }
        if (Object.keys(rowErrors).length === 0) {
          delete cellErrors[rowId];
        } else {
          cellErrors[rowId] = rowErrors;
        }
        return { cellErrors };
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
  }));
}

export function getEditableTableCellValue<
  Row extends object,
  ColumnId extends keyof Row & string
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

/**
 * Counts the cells that fail validation. A row pending deletion is not going to
 * be written, so — like its pending changes — its errors do not count and do not
 * block a save.
 */
export function getEditableTableErrorCount<Row extends object>(
  state: EditableTableStoreState<Row>
): number {
  return Object.entries(state.cellErrors).reduce(
    (errorCount, [rowId, rowErrors]) =>
      errorCount +
      (rowErrors && !state.deletedRowIds.has(rowId)
        ? Object.keys(rowErrors).length
        : 0),
    0
  );
}
