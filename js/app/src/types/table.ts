/**
 * Contracts for table features that span components, stores, and pages.
 *
 * Editing: a table opts its cells into editing by placing an {@link EditableTableMeta}
 * on `table.options.meta.editing`. Cells, toolbars, and pages program against
 * these interfaces; how the session is held and notified is left to whatever
 * implements {@link EditableTableStore}.
 */

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

/** Sparse `rowId -> columnId -> value` patches. */
export type EditableTableRowPatches<Row extends object> = Partial<
  Record<string, Partial<Row> | undefined>
>;

/** The data of an edit session. Server rows live outside the session. */
export interface EditableTableState<Row extends object> {
  readonly mode: EditableTableMode;
  /**
   * New rows, newest first, so a table can show them at the top. Each holds
   * the values the row started with; cell edits to a new row live in
   * `updatedRows` like edits to any other row.
   */
  readonly addedRows: readonly Row[];
  readonly addedRowIds: ReadonlySet<string>;
  /** Pending patches for existing and new rows. */
  readonly updatedRows: EditableTableRowPatches<Row>;
  readonly deletedRowIds: ReadonlySet<string>;
}

/** What a table and its cells may do to an edit session. */
export interface EditableTableActions<Row extends object> {
  /** Opens an edit session. */
  beginEditing(): void;
  /** Ends the session and drops every pending change. */
  cancelEditing(): void;
  /**
   * Holds the table in "saving" while the diff is committed and the rows are
   * reloaded: controls are disabled and pending changes stay visible. The
   * session never leaves "saving" on its own — whoever starts a save must end
   * it with `finishSaving` or `resumeEditing`.
   */
  startSaving(): void;
  /**
   * The save failed. Returns to "editing" with every pending change kept so
   * the save can be retried.
   */
  resumeEditing(): void;
  /**
   * The save succeeded and the reloaded rows have rendered. Ends the session
   * and drops the now-committed changes.
   */
  finishSaving(): void;
  addRow(row: Row): void;
  deleteRow(rowId: string): void;
  restoreRow(rowId: string): void;
  /**
   * Records a cell's value. A value equal to `originalValue` clears the
   * cell's pending change instead. Calls that change nothing leave the state
   * untouched, so subscribers are not notified.
   */
  updateCell<ColumnId extends keyof Row & string>(args: {
    rowId: string;
    columnId: ColumnId;
    value: Row[ColumnId];
    originalValue: Row[ColumnId];
  }): void;
  getDiff(): EditableTableDiff<Row>;
}

/** An edit session: its data and the actions that change it. */
export type EditableTableSession<Row extends object> = EditableTableState<Row> &
  EditableTableActions<Row>;

/**
 * Holds an edit session and notifies subscribers when it changes. The shape
 * is the subscribe-and-read subset of a store, so any store library — or a
 * hand-rolled implementation — can provide it, and React can subscribe with
 * `useStore`/`useSyncExternalStore`.
 */
export interface EditableTableStore<Row extends object> {
  getState(): EditableTableSession<Row>;
  getInitialState(): EditableTableSession<Row>;
  subscribe(
    listener: (
      session: EditableTableSession<Row>,
      previousSession: EditableTableSession<Row>
    ) => void
  ): () => void;
}

/**
 * What a table passes through `table.options.meta.editing` to opt its cells
 * into editing. Cells key their edits by TanStack's `row.id`, so the table's
 * `getRowId` option must return the same ID the store keys rows by.
 */
export interface EditableTableMeta<Row extends object> {
  store: EditableTableStore<Row>;
  /**
   * An extra rule for whether a cell may be edited. Rows marked for deletion
   * are never editable, whatever this returns.
   */
  isCellEditable?: (args: { row: Row; columnId: string }) => boolean;
}

export type EditableTableChangeCounts = {
  added: number;
  updated: number;
  deleted: number;
};
