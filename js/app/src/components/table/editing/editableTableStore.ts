import isEqual from "lodash/isEqual";
import type { StoreApi } from "zustand";
import { createStore } from "zustand";

export type EditableTableMode = "read" | "editing" | "saving";

export type EditableTableDiff<Row extends object> = {
  /** New rows, oldest first, with their pending cell edits applied. */
  addedRows: Row[];
  /** Existing rows whose cells changed, excluding rows marked for deletion. */
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
  /**
   * New rows, newest first, so a table can show them at the top. Each holds
   * the values the row started with; cell edits to a new row live in
   * `updatedRows` like edits to any other row.
   */
  addedRows: Row[];
  addedRowIds: Set<string>;
  /** Sparse `rowId -> columnId -> value` patches for existing and new rows. */
  updatedRows: EditableTableUpdatedRows<Row>;
  deletedRowIds: Set<string>;
  /** Opens an edit session. */
  beginEditing: () => void;
  /** Ends the session and drops every pending change. */
  cancelEditing: () => void;
  /**
   * Holds the table in "saving" while the diff is committed and the rows are
   * reloaded: controls are disabled and pending changes stay visible. The
   * store never leaves "saving" on its own — whoever starts a save must end
   * it with `finishSaving` or `resumeEditing`.
   */
  startSaving: () => void;
  /**
   * The save failed. Returns to "editing" with every pending change kept so
   * the save can be retried.
   */
  resumeEditing: () => void;
  /**
   * The save succeeded and the reloaded rows have rendered. Ends the session
   * and drops the now-committed changes.
   */
  finishSaving: () => void;
  addRow: (row: Row) => void;
  deleteRow: (rowId: string) => void;
  restoreRow: (rowId: string) => void;
  /**
   * Records a cell's value. A value equal to `originalValue` clears the
   * cell's pending change instead. Calls that change nothing leave the state
   * untouched, so subscribers are not notified.
   */
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

/**
 * How many rows each kind of change touches. Edits to a new row count toward
 * "added", not "updated"; edits to a row marked for deletion are not counted.
 */
export function getEditableTableChangeCounts<Row extends object>(
  state: EditableTableStoreState<Row>
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

export function getEditableTableChangeCount<Row extends object>(
  state: EditableTableStoreState<Row>
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
  state: EditableTableStoreState<Row>
): boolean {
  return state.mode !== "saving" && getEditableTableChangeCount(state) > 0;
}
