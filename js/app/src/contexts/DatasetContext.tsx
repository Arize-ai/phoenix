import type { PropsWithChildren } from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { useZustand } from "use-zustand";

import { subscribeToAgentDataChanges } from "@phoenix/agent/shared/agentDataChanges";
import type {
  DatasetStore,
  DatasetStoreState,
  InitialDatasetStoreProps,
} from "@phoenix/store/datasetStore";
import { createDatasetStore } from "@phoenix/store/datasetStore";

export const DatasetContext = createContext<DatasetStore | null>(null);

export function DatasetProvider({
  children,
  ...props
}: PropsWithChildren<InitialDatasetStoreProps>) {
  const [store] = useState<DatasetStore>(() => createDatasetStore(props));

  // PXI operations mutate this dataset from outside the page's own controls.
  // Do for them what the page's buttons do for themselves: a row change
  // advances the latest version (which the examples table refetches on), and
  // a label or split change re-reads the header's summary fields.
  useEffect(
    () =>
      subscribeToAgentDataChanges((change) => {
        const state = store.getState();
        if (change.entity === "datasetExamples") {
          if (change.datasetId === state.datasetId) {
            state.refreshLatestVersion().catch(() => {
              // A failed refresh leaves the previous version in place.
            });
          }
          return;
        }
        if (
          change.entity === "datasetLabels" ||
          change.entity === "datasetSplits"
        ) {
          state.refreshSummary().catch(() => {
            // Header keeps its last-known labels and splits.
          });
          if (change.entity === "datasetSplits") {
            // Rows carry their split chips; a deleted split has to fall off.
            state.requestExamplesRefresh();
          }
        }
      }),
    [store]
  );

  return (
    <DatasetContext.Provider value={store}>{children}</DatasetContext.Provider>
  );
}

export function useDatasetContext<T>(
  selector: (state: DatasetStoreState) => T,
  equalityFn?: (left: T, right: T) => boolean
): T {
  const store = useContext(DatasetContext);
  if (!store) throw new Error("Missing DatasetContext.Provider in the tree");
  return useZustand(store, selector, equalityFn);
}
