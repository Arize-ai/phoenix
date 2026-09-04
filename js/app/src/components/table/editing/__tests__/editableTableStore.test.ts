import {
  createEditableTableStore,
  getEditableTableChangeCount,
} from "../editableTableStore";

type TestRow = {
  id: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
};

const createStore = () =>
  createEditableTableStore<TestRow>({ getRowId: (row) => row.id });

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

  it("updates a newly added row without creating an update diff", () => {
    const store = createStore();
    store.getState().addRow({ id: "new-1", input: {}, output: {} });
    store.getState().updateCell({
      rowId: "new-1",
      columnId: "output",
      originalValue: {},
      value: { answer: 42 },
    });

    expect(store.getState().getDiff()).toEqual({
      addedRows: [{ id: "new-1", input: {}, output: { answer: 42 } }],
      updatedRows: [],
      deletedRowIds: [],
    });
  });

  it("removes a new row when it is deleted", () => {
    const store = createStore();
    store.getState().addRow({ id: "new-1", input: {}, output: {} });
    store.getState().deleteRow("new-1");

    expect(store.getState().getDiff()).toEqual({
      addedRows: [],
      updatedRows: [],
      deletedRowIds: [],
    });
  });

  it("suppresses updates for an existing row that is deleted", () => {
    const store = createStore();
    store.getState().updateCell({
      rowId: "row-1",
      columnId: "input",
      originalValue: {},
      value: { edited: true },
    });
    store.getState().deleteRow("row-1");

    expect(store.getState().getDiff()).toEqual({
      addedRows: [],
      updatedRows: [],
      deletedRowIds: ["row-1"],
    });
  });

  it("restores deleted rows", () => {
    const store = createStore();
    store.getState().deleteRow("row-1");
    store.getState().restoreRow("row-1");

    expect(store.getState().deletedRowIds.size).toBe(0);
  });

  it("tracks the change count", () => {
    const store = createStore();
    store.getState().addRow({ id: "new-1", input: {}, output: {} });
    store.getState().deleteRow("row-2");

    expect(getEditableTableChangeCount(store.getState())).toBe(2);
  });

  it("clears the full session on cancel and successful save", () => {
    const store = createStore();
    store.getState().beginEditing();
    store.getState().addRow({ id: "new-1", input: {}, output: {} });
    store.getState().cancelEditing();

    expect(store.getState().mode).toBe("read");
    expect(getEditableTableChangeCount(store.getState())).toBe(0);

    store.getState().beginEditing();
    store.getState().deleteRow("row-1");
    store.getState().startSaving();
    expect(store.getState().mode).toBe("saving");
    store.getState().finishSaving();

    expect(store.getState().mode).toBe("read");
    expect(getEditableTableChangeCount(store.getState())).toBe(0);
  });
});
