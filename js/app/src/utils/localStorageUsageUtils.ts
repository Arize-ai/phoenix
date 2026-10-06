import {
  AGENT_MODEL_CONFIG_STORAGE_BASE_KEY,
  ASSISTANT_STORAGE_BASE_KEY,
  CHAT_MODEL_STORAGE_BASE_KEY,
  CHAT_PARAMETERS_STORAGE_BASE_KEY,
  CREDENTIALS_STORAGE_KEY,
  DATASETS_TABLE_STORAGE_KEY,
  DISMISSED_UPDATE_VERSION_STORAGE_KEY,
  DRAWER_SIZE_STORAGE_KEY_PREFIX,
  EXPERIMENT_COMPARE_CHARTS_STORAGE_KEY,
  FEATURE_FLAGS_STORAGE_KEY,
  FILTER_HISTORY_STORAGE_KEY_PREFIX,
  PANEL_LAYOUT_STORAGE_KEY_PREFIX,
  PLAYGROUND_STORAGE_KEY,
  PREFERENCES_STORAGE_KEY,
  PROJECT_STORAGE_KEY_PREFIX,
  PROMPTS_TABLE_STORAGE_KEY,
  RECENTLY_VIEWED_STORAGE_KEY,
  THEME_STORAGE_KEY,
} from "@phoenix/constants/storageConstants";

import { scopeStorageKeyToBasename } from "./storageUtils";

/**
 * The sub-stores Phoenix keeps in the browser's `localStorage`. Each one
 * groups the keys a feature area persists so they can be reported on and
 * cleared independently. `other` catches Phoenix-prefixed keys no sub-store
 * claims (e.g. a key left behind by an older version).
 */
export type LocalStorageStoreId =
  | "preferences"
  | "featureFlags"
  | "layout"
  | "tables"
  | "playground"
  | "credentials"
  | "assistant"
  | "chat"
  | "filterHistory"
  | "recentlyViewed"
  | "notices"
  | "other";

export interface LocalStorageStoreDefinition {
  id: LocalStorageStoreId;
  /** Short, human-readable name shown in the storage settings. */
  label: string;
  /** What a user loses by clearing the sub-store. */
  description: string;
  /**
   * Exact keys that belong to the sub-store. Resolved at read time (not
   * module load) because scoped keys depend on `window.Config`.
   */
  resolveKeys?: () => string[];
  /** Key prefixes that belong to the sub-store. */
  prefixes?: readonly string[];
}

/**
 * Base keys that get scoped to the deployment root path (see
 * {@link scopeStorageKeyToBasename}). Entries under one of these bases but a
 * different root path belong to a co-hosted workspace and are never touched.
 */
const SCOPED_STORAGE_BASE_KEYS: readonly string[] = [
  ASSISTANT_STORAGE_BASE_KEY,
  AGENT_MODEL_CONFIG_STORAGE_BASE_KEY,
  CHAT_MODEL_STORAGE_BASE_KEY,
  CHAT_PARAMETERS_STORAGE_BASE_KEY,
];

/** Key prefixes that identify an entry as written by Phoenix. */
const PHOENIX_STORAGE_KEY_PREFIXES: readonly string[] = [
  "arize-phoenix",
  "__experimental__arize-phoenix",
  PANEL_LAYOUT_STORAGE_KEY_PREFIX,
];

export const LOCAL_STORAGE_STORES: readonly LocalStorageStoreDefinition[] = [
  {
    id: "preferences",
    label: "Preferences",
    description:
      "Theme, timezone, code language, package manager, and other display preferences.",
    resolveKeys: () => [PREFERENCES_STORAGE_KEY, THEME_STORAGE_KEY],
  },
  {
    id: "featureFlags",
    label: "Feature flags",
    description: "Experimental features toggled on in this browser.",
    resolveKeys: () => [FEATURE_FLAGS_STORAGE_KEY],
  },
  {
    id: "layout",
    label: "Layout",
    description: "Resizable panel and drawer sizes.",
    prefixes: [PANEL_LAYOUT_STORAGE_KEY_PREFIX, DRAWER_SIZE_STORAGE_KEY_PREFIX],
  },
  {
    id: "tables",
    label: "Tables and views",
    description:
      "Column visibility, sorting, and chart selections for projects, prompts, datasets, and experiments.",
    resolveKeys: () => [
      PROMPTS_TABLE_STORAGE_KEY,
      DATASETS_TABLE_STORAGE_KEY,
      EXPERIMENT_COMPARE_CHARTS_STORAGE_KEY,
    ],
    prefixes: [PROJECT_STORAGE_KEY_PREFIX],
  },
  {
    id: "playground",
    label: "Playground",
    description: "Saved playground prompts, model settings, and experiments.",
    resolveKeys: () => [PLAYGROUND_STORAGE_KEY],
  },
  {
    id: "credentials",
    label: "Model provider credentials",
    description:
      "API keys for model providers entered in the playground. These are only ever stored in this browser.",
    resolveKeys: () => [CREDENTIALS_STORAGE_KEY],
  },
  {
    id: "assistant",
    label: "Assistant",
    description: "Assistant conversation history and model selection.",
    resolveKeys: () => [
      scopeStorageKeyToBasename(ASSISTANT_STORAGE_BASE_KEY),
      scopeStorageKeyToBasename(AGENT_MODEL_CONFIG_STORAGE_BASE_KEY),
    ],
  },
  {
    id: "chat",
    label: "Chat",
    description: "Last-used chat model and parameters.",
    resolveKeys: () => [
      scopeStorageKeyToBasename(CHAT_MODEL_STORAGE_BASE_KEY),
      scopeStorageKeyToBasename(CHAT_PARAMETERS_STORAGE_BASE_KEY),
    ],
  },
  {
    id: "filterHistory",
    label: "Filter history",
    description: "Recent filter conditions suggested in filter fields.",
    prefixes: [FILTER_HISTORY_STORAGE_KEY_PREFIX],
  },
  {
    id: "recentlyViewed",
    label: "Recently viewed",
    description: "Recently opened projects, datasets, and prompts.",
    resolveKeys: () => [RECENTLY_VIEWED_STORAGE_KEY],
  },
  {
    id: "notices",
    label: "Dismissed notices",
    description: "Notifications you have dismissed, such as version updates.",
    resolveKeys: () => [DISMISSED_UPDATE_VERSION_STORAGE_KEY],
  },
  {
    id: "other",
    label: "Other",
    description:
      "Phoenix entries not covered above, such as those left by earlier versions.",
  },
];

export interface LocalStorageEntry {
  key: string;
  /** Approximate size of the key and value in bytes. */
  sizeBytes: number;
}

export interface LocalStorageStoreUsage extends LocalStorageStoreDefinition {
  entries: LocalStorageEntry[];
  entryCount: number;
  sizeBytes: number;
}

export interface LocalStorageUsage {
  stores: LocalStorageStoreUsage[];
  totalEntryCount: number;
  totalSizeBytes: number;
}

/**
 * Approximates the bytes an entry occupies. Browsers store strings as UTF-16
 * and count both the key and the value toward the origin's quota.
 */
export function getLocalStorageEntrySizeBytes(
  key: string,
  value: string
): number {
  return (key.length + value.length) * 2;
}

function isPhoenixStorageKey(key: string): boolean {
  return PHOENIX_STORAGE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/**
 * Whether the key is a scoped Phoenix key for a different root path than the
 * current deployment's, i.e. it belongs to a co-hosted workspace.
 */
function isForeignScopedStorageKey(key: string): boolean {
  return SCOPED_STORAGE_BASE_KEYS.some(
    (baseKey) =>
      key.startsWith(`${baseKey}:`) &&
      key !== scopeStorageKeyToBasename(baseKey)
  );
}

function storeMatchesKey(
  store: LocalStorageStoreDefinition,
  key: string
): boolean {
  if (store.resolveKeys?.().includes(key)) {
    return true;
  }
  return store.prefixes?.some((prefix) => key.startsWith(prefix)) ?? false;
}

/**
 * Resolves which sub-store a key belongs to, or `null` when the key is not
 * Phoenix's to manage (another app on the same origin, or a co-hosted
 * workspace's scoped entry).
 */
export function getLocalStorageStoreIdForKey(
  key: string
): LocalStorageStoreId | null {
  if (!isPhoenixStorageKey(key) || isForeignScopedStorageKey(key)) {
    return null;
  }
  const store = LOCAL_STORAGE_STORES.find(
    (candidate) => candidate.id !== "other" && storeMatchesKey(candidate, key)
  );
  return store?.id ?? "other";
}

function getStorage(storage?: Storage): Storage | null {
  if (storage) {
    return storage;
  }
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    // Accessing `localStorage` throws under some privacy settings.
    return null;
  }
}

function listStorageKeys(storage: Storage): string[] {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key !== null) {
      keys.push(key);
    }
  }
  return keys;
}

/**
 * Takes stock of every Phoenix entry in local storage, grouped by sub-store.
 * Sub-stores with no entries are still reported, with zero usage.
 */
export function readLocalStorageUsage(storage?: Storage): LocalStorageUsage {
  const entriesByStoreId = new Map<LocalStorageStoreId, LocalStorageEntry[]>();
  const resolvedStorage = getStorage(storage);
  if (resolvedStorage) {
    for (const key of listStorageKeys(resolvedStorage)) {
      const storeId = getLocalStorageStoreIdForKey(key);
      if (storeId === null) {
        continue;
      }
      const value = resolvedStorage.getItem(key) ?? "";
      const entries = entriesByStoreId.get(storeId) ?? [];
      entries.push({
        key,
        sizeBytes: getLocalStorageEntrySizeBytes(key, value),
      });
      entriesByStoreId.set(storeId, entries);
    }
  }
  const stores = LOCAL_STORAGE_STORES.map((store): LocalStorageStoreUsage => {
    const entries = (entriesByStoreId.get(store.id) ?? []).sort((a, b) =>
      a.key.localeCompare(b.key)
    );
    return {
      ...store,
      entries,
      entryCount: entries.length,
      sizeBytes: entries.reduce((total, entry) => total + entry.sizeBytes, 0),
    };
  });
  return {
    stores,
    totalEntryCount: stores.reduce(
      (total, store) => total + store.entryCount,
      0
    ),
    totalSizeBytes: stores.reduce((total, store) => total + store.sizeBytes, 0),
  };
}

/**
 * Removes every entry belonging to the given sub-store.
 *
 * @returns the number of entries removed
 */
export function clearLocalStorageStore(
  storeId: LocalStorageStoreId,
  storage?: Storage
): number {
  const resolvedStorage = getStorage(storage);
  if (!resolvedStorage) {
    return 0;
  }
  const keys = listStorageKeys(resolvedStorage).filter(
    (key) => getLocalStorageStoreIdForKey(key) === storeId
  );
  for (const key of keys) {
    resolvedStorage.removeItem(key);
  }
  return keys.length;
}

/**
 * Removes every Phoenix entry from local storage. Entries written by other
 * apps on the same origin, or by a co-hosted Phoenix workspace, are left
 * alone.
 *
 * @returns the number of entries removed
 */
export function clearAllLocalStorageStores(storage?: Storage): number {
  const resolvedStorage = getStorage(storage);
  if (!resolvedStorage) {
    return 0;
  }
  const keys = listStorageKeys(resolvedStorage).filter(
    (key) => getLocalStorageStoreIdForKey(key) !== null
  );
  for (const key of keys) {
    resolvedStorage.removeItem(key);
  }
  return keys.length;
}
