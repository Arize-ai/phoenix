import type {
  ColumnOrderState,
  ColumnSizingState,
  Updater,
  VisibilityState,
} from "@tanstack/react-table";
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

export interface PromptsTableStoreState {
  columnVisibility: VisibilityState;
  columnSizing: ColumnSizingState;
  columnOrder: ColumnOrderState;
  setColumnVisibility: (visibility: Updater<VisibilityState>) => void;
  setColumnSizing: (sizing: Updater<ColumnSizingState>) => void;
  setColumnOrder: (order: Updater<ColumnOrderState>) => void;
}

const PROMPTS_TABLE_STORE_VERSION = 1;
const PROMPTS_TABLE_STORE_KEY = "arize-phoenix-prompts-table";

export const createPromptsTableStore = () =>
  create<PromptsTableStoreState>()(
    persist(
      devtools(
        (set) => ({
          columnVisibility: {},
          columnSizing: {},
          columnOrder: [],
          setColumnVisibility: (visibility) => {
            set(
              (state) => ({
                columnVisibility:
                  typeof visibility === "function"
                    ? visibility(state.columnVisibility)
                    : visibility,
              }),
              false,
              { type: "setColumnVisibility" }
            );
          },
          setColumnSizing: (sizing) => {
            set(
              (state) => ({
                columnSizing:
                  typeof sizing === "function"
                    ? sizing(state.columnSizing)
                    : sizing,
              }),
              false,
              { type: "setColumnSizing" }
            );
          },
          setColumnOrder: (order) => {
            set(
              (state) => ({
                columnOrder:
                  typeof order === "function"
                    ? order(state.columnOrder)
                    : order,
              }),
              false,
              { type: "setColumnOrder" }
            );
          },
        }),
        { name: "promptsTableStore" }
      ),
      {
        name: PROMPTS_TABLE_STORE_KEY,
        version: PROMPTS_TABLE_STORE_VERSION,
        partialize: (state) => ({
          columnVisibility: state.columnVisibility,
          columnSizing: state.columnSizing,
          columnOrder: state.columnOrder,
        }),
      }
    )
  );

export type PromptsTableStore = ReturnType<typeof createPromptsTableStore>;
