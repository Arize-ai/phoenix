/**
 * Module-scoped session store for the details-panel sizing machine.
 *
 * This store — not React state, not localStorage — is the same-session
 * authority for panel sizing. It outlives every component, so closing the
 * panel (a route change that unmounts the page) cannot lose state, and
 * reopening derives from in-memory preferences without touching storage.
 *
 * Storage is durability only: it is read exactly once, when the store is
 * created (hydration), and written synchronously by the effect interpreter
 * when the machine emits a persistence effect on a deliberate release. There
 * is no storage read on any open/close path, so the historical
 * "reopen races the delayed write" defect class is unrepresentable.
 *
 * Storage writes are best-effort: a quota or privacy-mode failure degrades
 * reload durability but cannot affect same-session correctness, because no
 * same-session path reads the value back.
 */

import { TRACE_TREE_WIDTH_STORAGE_KEY } from "@phoenix/constants";

import type { SizingEvent, SizingState } from "./machine";
import { BOOL_FIELDS, createInitialState, INT_FIELDS } from "./machine";
import { transition } from "./transition";

const statesEqual = (a: SizingState, b: SizingState): boolean =>
  INT_FIELDS.every((field) => a[field] === b[field]) &&
  BOOL_FIELDS.every((field) => a[field] === b[field]);

/**
 * Kept identical to the key `useDefaultDrawerSize` used for the id
 * `details-panel-main-column`, so existing stored preferences carry over.
 */
export const MAIN_DETAILS_WIDTH_STORAGE_KEY =
  "arize-phoenix-drawer-details-panel-main-column-size";

export interface DetailsPanelSizingStore {
  getState: () => SizingState;
  dispatch: (event: SizingEvent) => SizingState;
  subscribe: (listener: () => void) => () => void;
}

const resolveStorage = (): Storage | null => {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    // Accessing `localStorage` throws under some privacy settings.
    return null;
  }
};

/** PS-5: absent/garbage/non-finite → null; the machine applies defaults. */
const readStoredWidth = (
  storage: Storage | null,
  key: string
): number | null => {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (raw == null || raw === "") return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export function createDetailsPanelSizingStore({
  storage = resolveStorage(),
  viewport,
}: {
  storage?: Storage | null;
  viewport: number;
}): DetailsPanelSizingStore {
  let state = createInitialState({
    treeRaw: readStoredWidth(storage, TRACE_TREE_WIDTH_STORAGE_KEY),
    mainRaw: readStoredWidth(storage, MAIN_DETAILS_WIDTH_STORAGE_KEY),
    viewport,
  });
  const listeners = new Set<() => void>();

  const persist = (key: string, value: number) => {
    if (!storage) return;
    try {
      storage.setItem(key, String(value));
    } catch {
      // Durability degrades; same-session state is unaffected by design.
    }
  };

  const dispatch = (event: SizingEvent): SizingState => {
    const result = transition(state, event);
    // Referential stability for unchanged states keeps subscribers quiet on
    // idempotent re-measurements (Q-1 guarantees these are value-equal).
    const changed = !statesEqual(result.state, state);
    if (changed) state = result.state;
    for (const effect of result.effects) {
      persist(
        effect.kind === "persistTree"
          ? TRACE_TREE_WIDTH_STORAGE_KEY
          : MAIN_DETAILS_WIDTH_STORAGE_KEY,
        effect.value
      );
    }
    if (changed) {
      for (const listener of listeners) listener();
    }
    return state;
  };

  return {
    getState: () => state,
    dispatch,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

let singleton: DetailsPanelSizingStore | null = null;

/**
 * The application store. Hydrates lazily on first access and then lives for
 * the page's lifetime; a full reload is the only ordinary path that reads
 * storage again.
 */
export function getDetailsPanelSizingStore(): DetailsPanelSizingStore {
  if (singleton) return singleton;
  const viewport =
    typeof window !== "undefined" ? Math.round(window.innerWidth) : 1;
  singleton = createDetailsPanelSizingStore({ viewport });
  if (typeof window !== "undefined") {
    window.addEventListener("resize", () => {
      singleton?.dispatch({
        type: "VIEWPORT",
        px: Math.round(window.innerWidth),
      });
    });
  }
  return singleton;
}

/** Test-only: drop the singleton so each test hydrates fresh. */
export function resetDetailsPanelSizingStoreForTesting(): void {
  singleton = null;
}
