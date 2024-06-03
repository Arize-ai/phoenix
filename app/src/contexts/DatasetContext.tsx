import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useRef,
} from "react";
import { useZustand } from "use-zustand";

import {
  createDatasetStore,
  DatasetStore,
  DatasetStoreProps,
  DatasetStoreState,
} from "@phoenix/store/datasetStore";

export const DatasetContext = createContext<DatasetStore | null>(null);

export function DatasetProvider({
  children,
  ...props
}: PropsWithChildren<Pick<DatasetStoreProps, "latestVersion">>) {
  const storeRef = useRef<DatasetStore>();
  if (!storeRef.current) {
    storeRef.current = createDatasetStore(props);
  }
  return (
    <DatasetContext.Provider value={storeRef.current}>
      {children}
    </DatasetContext.Provider>
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
