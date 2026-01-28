import { ColumnSizingState, Updater } from "@tanstack/react-table";
import { create, StateCreator } from "zustand";
import { devtools, persist } from "zustand/middleware";

import { ProjectTab } from "@phoenix/pages/project/constants";

type VisibilityState = Record<string, boolean>;
export interface TracingProps {
  /**
   * The project ID for this tracing context
   */
  projectId: string;
  /**
   * Map of the column id to the visibility state
   */
  columnVisibility: VisibilityState;
  /**
   * Map of the annotation column names that are toggled on
   */
  annotationColumnVisibility: VisibilityState;
  /**
   * Map of the column id to the width
   */
  columnSizing: ColumnSizingState;
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
  /**
   * Sets the width of a column
   */
  setColumnSizing: (updater: Updater<ColumnSizingState>) => void;
}

const makeTracingStoreKey = ({
  projectId,
  tableId,
}: {
  projectId: string;
  tableId: ProjectTab;
}) => `arize-phoenix-tracing-${projectId}-${tableId}`;

export type CreateTracingStoreProps = {
  projectId: string;
  tableId: ProjectTab;
} & Partial<TracingProps>;

export const createTracingStore = (initialProps: CreateTracingStoreProps) => {
  const tracingStore: StateCreator<
    TracingState,
    [["zustand/devtools", unknown]]
  > = (set) => ({
    projectId: initialProps.projectId,
    columnVisibility: {
      metadata: false,
    },
    columnSizing: {
      metadata: 200,
    },
    annotationColumnVisibility: {},
    setColumnVisibility: (columnVisibility) => {
      set({ columnVisibility }, false, { type: "setColumnVisibility" });
    },
    setAnnotationColumnVisibility: (annotationColumnVisibility) => {
      set({ annotationColumnVisibility }, false, {
        type: "setAnnotationColumnVisibility",
      });
    },
    setColumnSizing: (columnSizing) => {
      if (typeof columnSizing === "function") {
        set(
          (state) => ({
            columnSizing: columnSizing(state.columnSizing),
          }),
          false,
          { type: "setColumnSizing" }
        );
      } else {
        set({ columnSizing }, false, { type: "setColumnSizing" });
      }
    },
  });
  return create<TracingState>()(
    persist(
      devtools(tracingStore, {
        name: "tracingStore",
      }),
      {
        name: makeTracingStoreKey(initialProps),
      }
    )
  );
};

export type TracingStore = ReturnType<typeof createTracingStore>;
