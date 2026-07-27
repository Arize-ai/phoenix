/**
 * The store's storage boundary: hydration compatibility with the previously
 * persisted key formats, synchronous persistence on deliberate release, and
 * indifference to storage failure (durability degrades; same-session state
 * must not).
 */

import { describe, expect, it } from "vitest";

import { TRACE_TREE_WIDTH_STORAGE_KEY } from "@phoenix/constants";

import {
  createDetailsPanelSizingStore,
  MAIN_DETAILS_WIDTH_STORAGE_KEY,
} from "../store";

class FakeStorage implements Storage {
  private data = new Map<string, string>();
  public failWrites = false;

  get length(): number {
    return this.data.size;
  }
  clear(): void {
    this.data.clear();
  }
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error("quota exceeded");
    this.data.set(key, value);
  }
}

describe("details panel sizing store", () => {
  it("hydrates from the legacy key formats and defaults on garbage", () => {
    const storage = new FakeStorage();
    // usePersistedState wrote JSON numbers; useDefaultDrawerSize wrote String().
    storage.setItem(TRACE_TREE_WIDTH_STORAGE_KEY, "412");
    storage.setItem(MAIN_DETAILS_WIDTH_STORAGE_KEY, "951");
    const store = createDetailsPanelSizingStore({ storage, viewport: 1600 });
    expect(store.getState().prefTree).toBe(412);
    expect(store.getState().prefMain).toBe(951);

    const garbage = new FakeStorage();
    garbage.setItem(TRACE_TREE_WIDTH_STORAGE_KEY, '"not-a-number"');
    garbage.setItem(MAIN_DETAILS_WIDTH_STORAGE_KEY, "Infinity");
    const defaulted = createDetailsPanelSizingStore({
      storage: garbage,
      viewport: 1600,
    });
    expect(defaulted.getState().prefTree).toBe(368);
    expect(defaulted.getState().prefMain).toBe(960);
    // PS-5: the raw stored value is not rewritten by hydration.
    expect(garbage.getItem(TRACE_TREE_WIDTH_STORAGE_KEY)).toBe(
      '"not-a-number"'
    );
  });

  it("persists synchronously on deliberate release, before any close", () => {
    const storage = new FakeStorage();
    const store = createDetailsPanelSizingStore({ storage, viewport: 1600 });
    store.dispatch({ type: "OPEN" });
    store.dispatch({ type: "OUTER_MOVE", px: 1320 });
    store.dispatch({ type: "OUTER_END", px: 1320 });
    // 1320 − 368 (tree pref) − 1 (separator) = 951, written immediately.
    expect(storage.getItem(MAIN_DETAILS_WIDTH_STORAGE_KEY)).toBe("951");
  });

  it("keeps same-session state correct when storage writes fail", () => {
    const storage = new FakeStorage();
    const store = createDetailsPanelSizingStore({ storage, viewport: 1600 });
    storage.failWrites = true;
    store.dispatch({ type: "OPEN" });
    store.dispatch({ type: "OUTER_MOVE", px: 1320 });
    store.dispatch({ type: "OUTER_END", px: 1320 });
    store.dispatch({ type: "CLOSE" });
    store.dispatch({ type: "OPEN" });
    // Reopen never reads storage, so the failed write is irrelevant in-session.
    expect(store.getState().renderedDrawer).toBe(1320);
    expect(store.getState().prefMain).toBe(951);
  });

  it("notifies subscribers only on state change", () => {
    const store = createDetailsPanelSizingStore({
      storage: new FakeStorage(),
      viewport: 1600,
    });
    let notifications = 0;
    store.subscribe(() => notifications++);
    store.dispatch({ type: "OPEN" });
    const afterOpen = notifications;
    // Idempotent re-measurement (Q-1) must stay silent.
    store.dispatch({ type: "ALLOCATION", px: store.getState().renderedDrawer });
    store.dispatch({ type: "ALLOCATION", px: store.getState().renderedDrawer });
    expect(notifications).toBe(afterOpen);
  });
});
