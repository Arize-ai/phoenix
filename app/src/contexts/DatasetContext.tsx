import { createContext, PropsWithChildren, useContext, useState } from "react";
import { useZustand } from "use-zustand";

import {
  createDatasetStore,
  DatasetStore,
  DatasetStoreState,
  InitialDatasetStoreProps,
} from "@phoenix/store/datasetStore";

export const DatasetContext = createContext<DatasetStore | null>(null);

export function DatasetProvider({
  children,
  ...props
}: PropsWithChildren<InitialDatasetStoreProps>) {
  const [store] = useState<DatasetStore>(() => createDatasetStore(props));
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
