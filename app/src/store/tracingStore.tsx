import { create, StateCreator } from "zustand";
import { devtools, persist } from "zustand/middleware";

import { ProjectTab } from "@phoenix/pages/project/constants";

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
  return create<TracingState>()(
    persist(devtools(tracingStore), {
      name: makeTracingStoreKey(initialProps),
    })
  );
};

export type TracingStore = ReturnType<typeof createTracingStore>;
