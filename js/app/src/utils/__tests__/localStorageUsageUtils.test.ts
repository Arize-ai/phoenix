import { beforeEach, describe, expect, it } from "vitest";

import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import {
  CREDENTIALS_STORAGE_KEY,
  DATASET_STORAGE_KEY_PREFIX,
  DRAWER_SIZE_STORAGE_KEY_PREFIX,
  EXAMPLES_TABLE_STORAGE_KEY,
  EXPERIMENT_COMPARE_GRID_TABLE_STORAGE_KEY,
  EXPERIMENT_COMPARE_LIST_TABLE_STORAGE_KEY,
  EXPERIMENTS_TABLE_STORAGE_KEY_PREFIX,
  FEATURE_FLAGS_STORAGE_KEY,
  FILTER_HISTORY_STORAGE_KEY_PREFIX,
  PANEL_LAYOUT_STORAGE_KEY_PREFIX,
  PREFERENCES_STORAGE_KEY,
  PROJECT_STORAGE_KEY_PREFIX,
  THEME_STORAGE_KEY,
  TRACING_TABLE_STORAGE_KEY_PREFIX,
} from "@phoenix/constants/storageConstants";

import {
  clearAllLocalStorageStores,
  clearLocalStorageStore,
  getLocalStorageEntrySizeBytes,
  getLocalStorageStoreIdForKey,
  LOCAL_STORAGE_STORES,
  readLocalStorageUsage,
} from "../localStorageUsageUtils";

installTestStorage();

const originalBasename = window.Config.basename;

beforeEach(() => {
  window.Config.basename = originalBasename;
});

function getStoreUsage(id: string) {
  const store = readLocalStorageUsage().stores.find((s) => s.id === id);
  if (!store) {
    throw new Error(`missing store ${id}`);
  }
  return store;
}

describe("getLocalStorageEntrySizeBytes", () => {
  it("counts both the key and the value as UTF-16", () => {
    expect(getLocalStorageEntrySizeBytes("ab", "cde")).toBe(10);
    expect(getLocalStorageEntrySizeBytes("", "")).toBe(0);
  });
});

describe("getLocalStorageStoreIdForKey", () => {
  it("resolves exact and prefixed keys to their sub-store", () => {
    expect(getLocalStorageStoreIdForKey(PREFERENCES_STORAGE_KEY)).toBe(
      "preferences"
    );
    expect(getLocalStorageStoreIdForKey(THEME_STORAGE_KEY)).toBe("preferences");
    expect(getLocalStorageStoreIdForKey(CREDENTIALS_STORAGE_KEY)).toBe(
      "credentials"
    );
    expect(
      getLocalStorageStoreIdForKey(`${PROJECT_STORAGE_KEY_PREFIX}UHJvamVjdDox`)
    ).toBe("tables");
    expect(
      getLocalStorageStoreIdForKey(
        `${TRACING_TABLE_STORAGE_KEY_PREFIX}UHJvamVjdDox-traces`
      )
    ).toBe("tables");
    expect(
      getLocalStorageStoreIdForKey(`${DATASET_STORAGE_KEY_PREFIX}RGF0YXNldDox`)
    ).toBe("tables");
    expect(getLocalStorageStoreIdForKey(EXAMPLES_TABLE_STORAGE_KEY)).toBe(
      "tables"
    );
    expect(
      getLocalStorageStoreIdForKey(EXPERIMENT_COMPARE_LIST_TABLE_STORAGE_KEY)
    ).toBe("tables");
    expect(
      getLocalStorageStoreIdForKey(EXPERIMENT_COMPARE_GRID_TABLE_STORAGE_KEY)
    ).toBe("tables");
    // Predates the arize-phoenix- convention but is still Phoenix's
    expect(
      getLocalStorageStoreIdForKey(
        `${EXPERIMENTS_TABLE_STORAGE_KEY_PREFIX}visibility-RGF0YXNldDox`
      )
    ).toBe("tables");
    expect(
      getLocalStorageStoreIdForKey(
        `${DRAWER_SIZE_STORAGE_KEY_PREFIX}trace-size-v2`
      )
    ).toBe("layout");
    expect(
      getLocalStorageStoreIdForKey(
        `${PANEL_LAYOUT_STORAGE_KEY_PREFIX}trace-details-layout`
      )
    ).toBe("layout");
    expect(
      getLocalStorageStoreIdForKey(`${FILTER_HISTORY_STORAGE_KEY_PREFIX}spans`)
    ).toBe("filterHistory");
  });

  it("buckets unknown Phoenix keys as other and ignores foreign keys", () => {
    expect(getLocalStorageStoreIdForKey("arize-phoenix-legacy-thing")).toBe(
      "other"
    );
    expect(getLocalStorageStoreIdForKey("some-other-app")).toBeNull();
    expect(getLocalStorageStoreIdForKey("loglevel")).toBeNull();
  });

  it("never exposes feature flags, not even under other", () => {
    expect(getLocalStorageStoreIdForKey(FEATURE_FLAGS_STORAGE_KEY)).toBeNull();
  });

  it("resolves scoped keys for the current root path only", () => {
    window.Config.basename = "/";
    expect(getLocalStorageStoreIdForKey("arize-phoenix-assistant")).toBe(
      "assistant"
    );
    // Another workspace's entry on the same origin is not ours to manage
    expect(
      getLocalStorageStoreIdForKey("arize-phoenix-assistant:/s/other")
    ).toBeNull();

    window.Config.basename = "/s/phoenix-devs";
    expect(
      getLocalStorageStoreIdForKey("arize-phoenix-assistant:/s/phoenix-devs")
    ).toBe("assistant");
    expect(
      getLocalStorageStoreIdForKey("arize-phoenix-chat-model:/s/phoenix-devs")
    ).toBe("chat");
    expect(
      getLocalStorageStoreIdForKey("arize-phoenix-assistant:/s/other")
    ).toBeNull();
    // The unscoped key belongs to the single-tenant layout, not this
    // workspace, so it is not reported under a root path
    expect(getLocalStorageStoreIdForKey("arize-phoenix-assistant")).toBe(
      "other"
    );
  });
});

describe("readLocalStorageUsage", () => {
  it("reports every sub-store, empty ones included", () => {
    const usage = readLocalStorageUsage();
    expect(usage.stores.map((store) => store.id)).toEqual(
      LOCAL_STORAGE_STORES.map((store) => store.id)
    );
    expect(usage.totalEntryCount).toBe(0);
    expect(usage.totalSizeBytes).toBe(0);
    for (const store of usage.stores) {
      expect(store.entryCount).toBe(0);
      expect(store.entries).toEqual([]);
    }
  });

  it("groups entries by sub-store and sums their sizes", () => {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, '{"a":1}');
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    localStorage.setItem(`${PROJECT_STORAGE_KEY_PREFIX}abc`, "{}");
    localStorage.setItem("unrelated", "x".repeat(100));

    const usage = readLocalStorageUsage();
    const preferences = getStoreUsage("preferences");
    expect(preferences.entryCount).toBe(2);
    expect(preferences.entries.map((entry) => entry.key)).toEqual([
      PREFERENCES_STORAGE_KEY,
      THEME_STORAGE_KEY,
    ]);
    expect(preferences.sizeBytes).toBe(
      getLocalStorageEntrySizeBytes(PREFERENCES_STORAGE_KEY, '{"a":1}') +
        getLocalStorageEntrySizeBytes(THEME_STORAGE_KEY, "dark")
    );
    expect(getStoreUsage("tables").entryCount).toBe(1);
    expect(usage.totalEntryCount).toBe(3);
    expect(usage.totalSizeBytes).toBe(
      usage.stores.reduce((total, store) => total + store.sizeBytes, 0)
    );
  });

  it("accepts an explicit storage backend", () => {
    sessionStorage.setItem(THEME_STORAGE_KEY, "light");
    expect(readLocalStorageUsage(sessionStorage).totalEntryCount).toBe(1);
    expect(readLocalStorageUsage().totalEntryCount).toBe(0);
  });
});

describe("clearLocalStorageStore", () => {
  it("removes only the sub-store's entries", () => {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, "{}");
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    localStorage.setItem(CREDENTIALS_STORAGE_KEY, "{}");
    localStorage.setItem("unrelated", "keep");

    expect(clearLocalStorageStore("preferences")).toBe(2);

    expect(localStorage.getItem(PREFERENCES_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(CREDENTIALS_STORAGE_KEY)).toBe("{}");
    expect(localStorage.getItem("unrelated")).toBe("keep");
    expect(clearLocalStorageStore("preferences")).toBe(0);
  });
});

describe("clearAllLocalStorageStores", () => {
  it("removes every Phoenix entry and nothing else", () => {
    window.Config.basename = "/s/phoenix-devs";
    localStorage.setItem(FEATURE_FLAGS_STORAGE_KEY, '{"x":true}');
    localStorage.setItem(PREFERENCES_STORAGE_KEY, "{}");
    localStorage.setItem(`${PANEL_LAYOUT_STORAGE_KEY_PREFIX}layout`, "[]");
    localStorage.setItem(
      `${EXPERIMENTS_TABLE_STORAGE_KEY_PREFIX}order-x`,
      "[]"
    );
    localStorage.setItem("arize-phoenix-assistant:/s/phoenix-devs", "{}");
    localStorage.setItem("arize-phoenix-legacy", "{}");
    localStorage.setItem("arize-phoenix-assistant:/s/other", "{}");
    localStorage.setItem("unrelated", "keep");

    expect(clearAllLocalStorageStores()).toBe(5);

    expect(localStorage.length).toBe(3);
    expect(localStorage.getItem(FEATURE_FLAGS_STORAGE_KEY)).toBe('{"x":true}');
    expect(localStorage.getItem("arize-phoenix-assistant:/s/other")).toBe("{}");
    expect(localStorage.getItem("unrelated")).toBe("keep");
    expect(readLocalStorageUsage().totalEntryCount).toBe(0);
  });
});
