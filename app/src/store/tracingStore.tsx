import { create, StateCreator } from "zustand";
import { devtools } from "zustand/middleware";

type VisibilityState = Record<string, boolean>;
export interface TracingProps {
  /**
   * Map of the column id to the visibility state
   */
  columnVisibility: VisibilityState;
  /**
   * Map of the evaluation names that are toggled on
   */
  evaluationVisibility: VisibilityState;
  /**
   * The aggregate span evaluation names selected and displayed
   */
  aggregateSpanEvaluationNames: string[];
}

export interface TracingState extends TracingProps {
  /**
   * Sets the visibility state of a column
   * @param columnVisibility
   * @returns
   */
  setColumnVisibility: (columnVisibility: VisibilityState) => void;
  /**
   * Sets the visibility of the evaluation columns
   */
  setEvaluationVisibility: (evaluationVisibility: VisibilityState) => void;
}

export const createTracingStore = (initialProps?: Partial<TracingProps>) => {
  const tracingStore: StateCreator<TracingState> = (set) => ({
    ...initialProps,
    columnVisibility: {},
    evaluationVisibility: {},
    aggregateSpanEvaluationNames: [],
    setColumnVisibility: (columnVisibility) => {
      set({ columnVisibility });
    },
    setEvaluationVisibility: (evaluationVisibility) => {
      set({ evaluationVisibility });
    },
  });
  return create<TracingState>()(devtools(tracingStore));
};

export type TracingStore = ReturnType<typeof createTracingStore>;
