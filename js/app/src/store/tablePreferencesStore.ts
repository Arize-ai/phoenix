import type {
  ColumnOrderState,
  ColumnSizingState,
  Updater,
  VisibilityState,
} from "@tanstack/react-table";
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

export interface TablePreferencesState {
  columnVisibility: VisibilityState;
  columnSizing: ColumnSizingState;
  columnOrder: ColumnOrderState;
  setColumnVisibility: (visibility: Updater<VisibilityState>) => void;
  setColumnSizing: (sizing: Updater<ColumnSizingState>) => void;
  setColumnOrder: (order: Updater<ColumnOrderState>) => void;
}

const TABLE_PREFERENCES_VERSION = 1;

/** Applies a tanstack `Updater`, which is either the next value or a function producing it. */
function applyUpdater<T>(updater: Updater<T>, previous: T): T {
  return typeof updater === "function"
    ? (updater as (previous: T) => T)(previous)
    : updater;
}

/**
 * Creates a store holding a single table's column preferences, persisted to
 * local storage under `storageKey`. The setters take tanstack `Updater`s so
 * they can be passed straight to `useReactTable`'s `onColumn*Change` handlers.
 */
export function createTablePreferencesStore({
  name,
  storageKey,
}: {
  /** Name the store shows up under in redux devtools. */
  name: string;
  /** Local storage key the preferences persist to. */
  storageKey: string;
}) {
  return create<TablePreferencesState>()(
    persist(
      devtools(
        (set) => ({
          columnVisibility: {},
          columnSizing: {},
          columnOrder: [],
          setColumnVisibility: (visibility) => {
            set(
              (state) => ({
                columnVisibility: applyUpdater(
                  visibility,
                  state.columnVisibility
                ),
              }),
              false,
              { type: "setColumnVisibility" }
            );
          },
          setColumnSizing: (sizing) => {
            set(
              (state) => ({
                columnSizing: applyUpdater(sizing, state.columnSizing),
              }),
              false,
              { type: "setColumnSizing" }
            );
          },
          setColumnOrder: (order) => {
            set(
              (state) => ({
                columnOrder: applyUpdater(order, state.columnOrder),
              }),
              false,
              { type: "setColumnOrder" }
            );
          },
        }),
        { name }
      ),
      {
        name: storageKey,
        version: TABLE_PREFERENCES_VERSION,
        partialize: ({ columnVisibility, columnSizing, columnOrder }) => ({
          columnVisibility,
          columnSizing,
          columnOrder,
        }),
      }
    )
  );
}

export type TablePreferencesStore = ReturnType<
  typeof createTablePreferencesStore
>;
