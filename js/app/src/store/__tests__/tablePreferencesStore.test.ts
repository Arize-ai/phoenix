import { beforeEach, describe, expect, it } from "vitest";

import { createTablePreferencesStore } from "../tablePreferencesStore";

const STORAGE_KEY = "arize-phoenix-test-table";

const createStore = () =>
  createTablePreferencesStore({
    name: "testTableStore",
    storageKey: STORAGE_KEY,
  });

describe("tablePreferencesStore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("persists the table preferences together with an independent version", () => {
    const store = createStore();

    store.getState().setColumnVisibility({ description: false });
    store.getState().setColumnSizing({ name: 320 });
    store.getState().setColumnOrder(["name", "description"]);

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null")).toEqual({
      state: {
        columnVisibility: { description: false },
        columnSizing: { name: 320 },
        columnOrder: ["name", "description"],
      },
      version: 1,
    });
  });

  it("supports functional updates from TanStack Table", () => {
    const store = createStore();

    store.getState().setColumnSizing({ name: 200 });
    store
      .getState()
      .setColumnSizing((columnSizing) => ({ ...columnSizing, name: 280 }));

    expect(store.getState().columnSizing).toEqual({ name: 280 });
  });
});
