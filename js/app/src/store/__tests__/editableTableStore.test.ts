import {
  createEditableTableStore,
  getEditableTableCellValue,
  getEditableTableChangeCount,
  getEditableTableChangeCounts,
  getEditableTableHiddenChangeCount,
  hasEditableTableUnsavedChanges,
} from "../editableTableStore";

type TestRow = {
  id: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
};

const createStore = () =>
  createEditableTableStore<TestRow>({ getRowId: (row) => row.id });

const editRow1 = (store: ReturnType<typeof createStore>) =>
  store.getState().updateCell({
    rowId: "row-1",
    columnId: "input",
    originalValue: {},
    value: { edited: true },
  });

describe("editableTableStore", () => {
  it("tracks only changed cells and removes reverted changes", () => {
    const store = createStore();
    const originalInput = { question: "original" };

    store.getState().updateCell({
      rowId: "row-1",
      columnId: "input",
      originalValue: originalInput,
      value: { question: "edited" },
    });

    expect(store.getState().getDiff().updatedRows).toEqual([
      {
        rowId: "row-1",
        changes: { input: { question: "edited" } },
      },
    ]);

    store.getState().updateCell({
      rowId: "row-1",
      columnId: "input",
      originalValue: originalInput,
      value: { question: "original" },
    });

    expect(store.getState().getDiff().updatedRows).toEqual([]);
  });

  it("leaves the state untouched when an edit changes nothing", () => {
    const store = createStore();
    const before = store.getState();

    store.getState().updateCell({
      rowId: "row-1",
      columnId: "input",
      originalValue: { question: "same" },
      value: { question: "same" },
    });
    expect(store.getState()).toBe(before);

    editRow1(store);
    const afterEdit = store.getState();
    editRow1(store);
    expect(store.getState()).toBe(afterEdit);
  });

  it("edits a new row's cells without rebuilding the added rows", () => {
    const store = createStore();
    store.getState().addRow({ id: "new-1", input: {}, output: {} });
    const addedRowsBefore = store.getState().addedRows;

    store.getState().updateCell({
      rowId: "new-1",
      columnId: "output",
      originalValue: {},
      value: { answer: 42 },
    });

    const state = store.getState();
    expect(state.addedRows).toBe(addedRowsBefore);
    expect(
      getEditableTableCellValue({
        state,
        rowId: "new-1",
        columnId: "output",
        originalValue: {},
      })
    ).toEqual({ answer: 42 });
    // The edit belongs to the addition, not to an update.
    expect(getEditableTableChangeCounts(state)).toEqual({
      added: 1,
      updated: 0,
      deleted: 0,
    });
    expect(state.getDiff()).toEqual({
      addedRows: [{ id: "new-1", input: {}, output: { answer: 42 } }],
      updatedRows: [],
      deletedRowIds: [],
    });
  });

  it("lists new rows oldest first in the diff", () => {
    const store = createStore();
    store.getState().addRow({ id: "new-1", input: {}, output: {} });
    store.getState().addRow({ id: "new-2", input: {}, output: {} });

    // Newest first for display, oldest first for the save.
    expect(store.getState().addedRows.map((row) => row.id)).toEqual([
      "new-2",
      "new-1",
    ]);
    expect(
      store
        .getState()
        .getDiff()
        .addedRows.map((row) => row.id)
    ).toEqual(["new-1", "new-2"]);
  });

  it("removes a new row and its edits when it is deleted", () => {
    const store = createStore();
    store.getState().addRow({ id: "new-1", input: {}, output: {} });
    store.getState().updateCell({
      rowId: "new-1",
      columnId: "output",
      originalValue: {},
      value: { answer: 42 },
    });
    store.getState().deleteRow("new-1");

    expect(store.getState().updatedRows).toEqual({});
    expect(store.getState().getDiff()).toEqual({
      addedRows: [],
      updatedRows: [],
      deletedRowIds: [],
    });
  });

  it("masks an update while its row is deleted and brings it back on restore", () => {
    const store = createStore();
    editRow1(store);
    store.getState().deleteRow("row-1");

    expect(store.getState().getDiff().updatedRows).toEqual([]);
    expect(getEditableTableChangeCounts(store.getState())).toEqual({
      added: 0,
      updated: 0,
      deleted: 1,
    });

    store.getState().restoreRow("row-1");
    expect(store.getState().getDiff()).toEqual({
      addedRows: [],
      updatedRows: [{ rowId: "row-1", changes: { input: { edited: true } } }],
      deletedRowIds: [],
    });
    expect(getEditableTableChangeCounts(store.getState())).toEqual({
      added: 0,
      updated: 1,
      deleted: 0,
    });
  });

  it("ignores restores of undeleted rows, repeated deletes, and duplicate adds", () => {
    const store = createStore();
    store
      .getState()
      .addRow({ id: "new-1", input: { first: true }, output: {} });
    store
      .getState()
      .addRow({ id: "new-1", input: { second: true }, output: {} });
    store.getState().restoreRow("new-1");
    store.getState().restoreRow("row-never-deleted");
    store.getState().deleteRow("row-1");
    store.getState().deleteRow("row-1");

    expect(store.getState().getDiff()).toEqual({
      addedRows: [{ id: "new-1", input: { first: true }, output: {} }],
      updatedRows: [],
      deletedRowIds: ["row-1"],
    });
    expect(getEditableTableChangeCount(store.getState())).toBe(2);
  });

  it("uses the configured comparator to decide whether a cell changed", () => {
    const store = createEditableTableStore<TestRow>({
      getRowId: (row) => row.id,
      areValuesEqual: (left, right) =>
        JSON.stringify(left).toLowerCase() ===
        JSON.stringify(right).toLowerCase(),
    });
    store.getState().updateCell({
      rowId: "row-1",
      columnId: "input",
      originalValue: { question: "hello" },
      value: { question: "HELLO" },
    });

    expect(store.getState().getDiff().updatedRows).toEqual([]);
  });

  it("keeps the changes when a save fails and drops them when a save completes", () => {
    const store = createStore();
    store.getState().beginEditing();
    editRow1(store);
    store.getState().addRow({ id: "new-1", input: {}, output: {} });
    store.getState().deleteRow("row-2");
    const pendingDiff = store.getState().getDiff();

    store.getState().startSaving();
    expect(store.getState().mode).toBe("saving");
    store.getState().resumeEditing();
    expect(store.getState().mode).toBe("editing");
    expect(store.getState().getDiff()).toEqual(pendingDiff);
    expect(getEditableTableChangeCount(store.getState())).toBe(3);

    store.getState().startSaving();
    store.getState().finishSaving();
    expect(store.getState().mode).toBe("read");
    expect(store.getState().getDiff()).toEqual({
      addedRows: [],
      updatedRows: [],
      deletedRowIds: [],
    });
  });

  it("clears the full session on cancel", () => {
    const store = createStore();
    store.getState().beginEditing();
    store.getState().addRow({ id: "new-1", input: {}, output: {} });
    store.getState().cancelEditing();

    expect(store.getState().mode).toBe("read");
    expect(getEditableTableChangeCount(store.getState())).toBe(0);
  });

  it("counts changes as unsaved only outside of saving", () => {
    const store = createStore();
    store.getState().beginEditing();
    expect(hasEditableTableUnsavedChanges(store.getState())).toBe(false);

    editRow1(store);
    expect(hasEditableTableUnsavedChanges(store.getState())).toBe(true);

    store.getState().startSaving();
    expect(hasEditableTableUnsavedChanges(store.getState())).toBe(false);

    store.getState().resumeEditing();
    expect(hasEditableTableUnsavedChanges(store.getState())).toBe(true);

    store.getState().finishSaving();
    expect(hasEditableTableUnsavedChanges(store.getState())).toBe(false);
  });

  it("counts changed existing rows that are not among the loaded rows", () => {
    const store = createStore();
    store.getState().beginEditing();
    editRow1(store);
    store.getState().deleteRow("row-2");
    store.getState().addRow({ id: "new-1", input: {}, output: {} });
    store.getState().updateCell({
      rowId: "new-1",
      columnId: "input",
      originalValue: {},
      value: { edited: true },
    });

    const count = (loadedRowIds: string[]) =>
      getEditableTableHiddenChangeCount({
        state: store.getState(),
        loadedRowIds: new Set(loadedRowIds),
      });

    expect(count(["row-1", "row-2"])).toBe(0);
    expect(count(["row-1"])).toBe(1);
    // New rows always render, so they never count as hidden.
    expect(count([])).toBe(2);

    // A hidden row's update is masked by its deletion, as in the diff.
    store.getState().deleteRow("row-1");
    expect(count([])).toBe(2);
  });
});
