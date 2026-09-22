import type { ColumnSizingState, Updater } from "@tanstack/react-table";
import type { StateCreator, StoreApi, UseBoundStore } from "zustand";
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

import type { ProjectTab } from "@phoenix/pages/project/constants";
import { TRACE_ANNOTATIONS_COLUMN_ID } from "@phoenix/pages/project/tableUtils";

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
   * Map of the trace annotation column names that are toggled on
   */
  traceAnnotationColumnVisibility: VisibilityState;
  /**
   * Map of the column id to the width
   */
  columnSizing: ColumnSizingState;
  /** Order of top-level columns by id. Empty means natural order. */
  columnOrder: string[];
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
   * Sets the visibility of the trace annotation columns
   */
  setTraceAnnotationColumnVisibility: (
    traceAnnotationColumnVisibility: VisibilityState
  ) => void;
  /**
   * Sets the width of a column
   */
  setColumnSizing: (updater: Updater<ColumnSizingState>) => void;
  /**
   * Sets the order of the top-level columns
   */
  setColumnOrder: (columnOrder: string[]) => void;
}

const makeTracingStoreKey = ({
  projectId,
  tableId,
}: {
  projectId: string;
  tableId: ProjectTab;
}) => `arize-phoenix-tracing-${projectId}-${tableId}`;

/** Initial values are read once when the store is created. */
export type CreateTracingStoreProps = {
  projectId: string;
  tableId: ProjectTab;
  /** Persist column preferences to localStorage. @default true */
  persistPreferences?: boolean;
} & Partial<TracingProps>;

export type TracingStore = UseBoundStore<StoreApi<TracingState>>;

export const createTracingStore = ({
  persistPreferences = true,
  ...initialProps
}: CreateTracingStoreProps): TracingStore => {
  const tracingStore: StateCreator<
    TracingState,
    [["zustand/devtools", unknown]]
  > = (set) => ({
    projectId: initialProps.projectId,
    columnVisibility: initialProps.columnVisibility ?? {
      metadata: false,
      spanNotes: false,
      traceNotes: false,
      spanId: false,
      traceId: false,
      [TRACE_ANNOTATIONS_COLUMN_ID]: false,
    },
    columnSizing: initialProps.columnSizing ?? {
      metadata: 200,
    },
    annotationColumnVisibility: initialProps.annotationColumnVisibility ?? {},
    traceAnnotationColumnVisibility:
      initialProps.traceAnnotationColumnVisibility ?? {},
    columnOrder: [],
    setColumnVisibility: (columnVisibility) => {
      set({ columnVisibility }, false, { type: "setColumnVisibility" });
    },
    setAnnotationColumnVisibility: (annotationColumnVisibility) => {
      set({ annotationColumnVisibility }, false, {
        type: "setAnnotationColumnVisibility",
      });
    },
    setTraceAnnotationColumnVisibility: (traceAnnotationColumnVisibility) => {
      set({ traceAnnotationColumnVisibility }, false, {
        type: "setTraceAnnotationColumnVisibility",
      });
    },
    setColumnOrder: (columnOrder) => {
      set({ columnOrder }, false, { type: "setColumnOrder" });
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
  const store = devtools(tracingStore, { name: "tracingStore" });
  if (!persistPreferences) {
    return create<TracingState>()(store);
  }
  return create<TracingState>()(
    persist(store, { name: makeTracingStoreKey(initialProps) })
  );
};
