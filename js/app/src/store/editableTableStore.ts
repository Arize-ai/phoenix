import isEqual from "lodash/isEqual";
import { createStore } from "zustand";

import type {
  EditableTableChangeCounts,
  EditableTableSession,
  EditableTableState,
  EditableTableStore,
} from "@phoenix/types/table";

export type CreateEditableTableStoreOptions<Row extends object> = {
  /**
   * Identifies a row. Must return the same ID the table's `getRowId` option
   * returns, since cells key their edits by TanStack's `row.id`.
   */
  getRowId: (row: Row) => string;
  areValuesEqual?: (left: unknown, right: unknown) => boolean;
};

/**
 * The pristine edit state. Built fresh on every reset so no two stores — and
 * no two editing sessions — ever share a collection instance.
 */
const createEmptyEditState = <
  Row extends object,
>(): EditableTableState<Row> => ({
  mode: "read",
  addedRows: [],
  addedRowIds: new Set<string>(),
  updatedRows: {},
  deletedRowIds: new Set<string>(),
});

/**
 * Creates a table-scoped sparse edit store backed by zustand.
 *
 * Server rows remain outside this store. Only additions, changed cells, and
 * deletions are retained here. The result is typed as the
 * `EditableTableStore` interface, so consumers depend on the contract rather
 * than on zustand.
 */
export function createEditableTableStore<Row extends object>({
  getRowId,
  areValuesEqual = isEqual,
}: CreateEditableTableStoreOptions<Row>): EditableTableStore<Row> {
  return createStore<EditableTableSession<Row>>()((set, get) => {
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
      resumeEditing: () => {
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
          // Deleting a new row removes the addition outright, along with any
          // edits made to it.
          if (state.addedRowIds.has(rowId)) {
            const addedRowIds = new Set(state.addedRowIds);
            addedRowIds.delete(rowId);
            const updatedRows = { ...state.updatedRows };
            delete updatedRows[rowId];
            return {
              addedRows: state.addedRows.filter(
                (addedRow) => getRowId(addedRow) !== rowId
              ),
              addedRowIds,
              updatedRows,
            };
          }
          if (state.deletedRowIds.has(rowId)) {
            return state;
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
          const previousChanges: Partial<Row> = state.updatedRows[rowId] ?? {};
          const hasStoredChange = Object.hasOwn(previousChanges, columnId);
          const isOriginal = areValuesEqual(value, originalValue);
          if (isOriginal && !hasStoredChange) {
            return state;
          }
          if (
            !isOriginal &&
            hasStoredChange &&
            areValuesEqual(previousChanges[columnId], value)
          ) {
            return state;
          }
          const rowChanges: Partial<Row> = { ...previousChanges };
          if (isOriginal) {
            delete rowChanges[columnId];
          } else {
            rowChanges[columnId] = value;
          }
          const updatedRows = { ...state.updatedRows };
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
              entry[1] !== undefined &&
              !state.addedRowIds.has(entry[0]) &&
              !state.deletedRowIds.has(entry[0])
          )
          .map(([rowId, changes]) => ({ rowId, changes }));
        // `addedRows` is newest first for display; the diff lists new rows in the
        // order they were added so they are created in that order.
        const addedRows = [...state.addedRows].reverse().map((row) => ({
          ...row,
          ...state.updatedRows[getRowId(row)],
        }));
        return {
          addedRows,
          updatedRows,
          deletedRowIds: [...state.deletedRowIds],
        };
      },
    };
  });
}

/**
 * A cell's current value: its pending edit if it has one, otherwise the value
 * the row was loaded (or added) with.
 */
export function getEditableTableCellValue<
  Row extends object,
  ColumnId extends keyof Row & string,
>({
  state,
  rowId,
  columnId,
  originalValue,
}: {
  state: EditableTableState<Row>;
  rowId: string;
  columnId: ColumnId;
  originalValue: Row[ColumnId];
}): Row[ColumnId] {
  const rowChanges = state.updatedRows[rowId];
  return rowChanges && Object.hasOwn(rowChanges, columnId)
    ? (rowChanges[columnId] as Row[ColumnId])
    : originalValue;
}

/**
 * How many rows each kind of change touches. Edits to a new row count toward
 * "added", not "updated"; edits to a row marked for deletion are not counted.
 */
export function getEditableTableChangeCounts<Row extends object>(
  state: EditableTableState<Row>
): EditableTableChangeCounts {
  const updated = Object.keys(state.updatedRows).filter(
    (rowId) => !state.addedRowIds.has(rowId) && !state.deletedRowIds.has(rowId)
  ).length;
  return {
    added: state.addedRows.length,
    updated,
    deleted: state.deletedRowIds.size,
  };
}

/**
 * How many changed existing rows are absent from `loadedRowIds`, the rows the
 * table currently holds. Changes are keyed by row ID, so a row that a search
 * or a page boundary hides keeps its pending update or deletion; this count
 * lets the table say so. New rows are never hidden, so they are not counted.
 */
export function getEditableTableHiddenChangeCount<Row extends object>({
  state,
  loadedRowIds,
}: {
  state: EditableTableState<Row>;
  loadedRowIds: ReadonlySet<string>;
}): number {
  let hidden = 0;
  for (const rowId of state.deletedRowIds) {
    if (!loadedRowIds.has(rowId)) {
      hidden += 1;
    }
  }
  for (const rowId of Object.keys(state.updatedRows)) {
    if (
      !state.addedRowIds.has(rowId) &&
      !state.deletedRowIds.has(rowId) &&
      !loadedRowIds.has(rowId)
    ) {
      hidden += 1;
    }
  }
  return hidden;
}

export function getEditableTableChangeCount<Row extends object>(
  state: EditableTableState<Row>
): number {
  const { added, updated, deleted } = getEditableTableChangeCounts(state);
  return added + updated + deleted;
}

/**
 * Whether leaving the table would lose work. A save keeps its changes in the
 * store until the committed rows come back, so changes count as unsaved only
 * outside "saving" mode.
 */
export function hasEditableTableUnsavedChanges<Row extends object>(
  state: EditableTableState<Row>
): boolean {
  return state.mode !== "saving" && getEditableTableChangeCount(state) > 0;
}
