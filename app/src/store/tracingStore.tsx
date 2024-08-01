import { create, StateCreator } from "zustand";
import { devtools } from "zustand/middleware";

type VisibilityState = Record<string, boolean>;
export interface TracingProps {
  /**
   * Map of the column id to the visibility state
   */
  columnVisibility: VisibilityState;
  /**
   * Map of the annotation column names that are toggled on
   */
  annotationColumnVisibility: VisibilityState;
}

export interface TracingState extends TracingProps {
  /**
   * Sets the visibility state of a column
   * @param columnVisibility
   * @returns
   */
  setColumnVisibility: (columnVisibility: VisibilityState) => void;
  /**
   * Sets the visibility of the annotation columns
   */
  setAnnotationColumnVisibility: (
    annotationColumnVisibility: VisibilityState
  ) => void;
}

export const createTracingStore = (initialProps?: Partial<TracingProps>) => {
  const tracingStore: StateCreator<TracingState> = (set) => ({
    ...initialProps,
    columnVisibility: {
      metadata: false,
    },
    annotationColumnVisibility: {},
    setColumnVisibility: (columnVisibility) => {
      set({ columnVisibility });
    },
    setAnnotationColumnVisibility: (annotationColumnVisibility) => {
      set({ annotationColumnVisibility });
    },
  });
  return create<TracingState>()(devtools(tracingStore));
};

export type TracingStore = ReturnType<typeof createTracingStore>;
