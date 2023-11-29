import { create, StateCreator } from "zustand";
import { devtools } from "zustand/middleware";

type VisibilityState = Record<string, boolean>;
export interface TracingProps {
  /**
   * Map of the column id to the visibility state
   */
  columnVisibility: VisibilityState;
}

export interface TracingState extends TracingProps {
  /**
   * Sets the visibility state of a column
   * @param columnVisibility
   * @returns
   */
  setColumnVisibility: (columnVisibility: VisibilityState) => void;
}

export const createTracingStore = (initialProps?: Partial<TracingProps>) => {
  const tracingStore: StateCreator<TracingState> = (set) => ({
    ...initialProps,
    columnVisibility: {},
    setColumnVisibility: (columnVisibility) => {
      set({ columnVisibility });
    },
  });
  return create<TracingState>()(devtools(tracingStore));
};

export type TracingStore = ReturnType<typeof createTracingStore>;
