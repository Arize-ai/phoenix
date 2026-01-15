import {
  createContext,
  PropsWithChildren,
  useContext,
  useMemo,
  useRef,
} from "react";
import { useZustand } from "use-zustand";

import {
  createPlaygroundStore,
  InitialPlaygroundState,
  PlaygroundState,
  PlaygroundStore,
} from "@phoenix/store";

export const PlaygroundContext = createContext<PlaygroundStore | null>(null);

type PlaygroundProviderProps = PropsWithChildren<
  InitialPlaygroundState & {
    /**
     * Optional dataset ID. When provided, the store uses a dataset-specific
     * localStorage key for persistence. Changing this value recreates the store.
     */
    datasetId?: string;
  }
>;

export function PlaygroundProvider({
  children,
  datasetId,
  ...props
}: PlaygroundProviderProps) {
  // Track the datasetId to detect changes
  const datasetIdRef = useRef(datasetId);
  const storeRef = useRef<PlaygroundStore | null>(null);

  // Create or recreate the store when datasetId changes
  const store = useMemo(() => {
    // If datasetId changed and we have an existing store, we need a new one
    if (datasetIdRef.current !== datasetId) {
      datasetIdRef.current = datasetId;
    }
    storeRef.current = createPlaygroundStore(props, datasetId);
    return storeRef.current;
    // We intentionally only depend on datasetId to recreate the store
    // eslint-disable-next-line react-compiler/react-compiler
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetId]);

  return (
    <PlaygroundContext.Provider value={store}>
      {children}
    </PlaygroundContext.Provider>
  );
}

export function usePlaygroundContext<T>(
  selector: (state: PlaygroundState) => T,
  equalityFn?: (left: T, right: T) => boolean
): T {
  const store = useContext(PlaygroundContext);
  if (!store) throw new Error("Missing PlaygroundContext.Provider in the tree");
  return useZustand(store, selector, equalityFn);
}

/**
 * Returns the raw playground store. Should only be used for accessing the store directly.
 * Using this hook ensures up to date (non stale) values in hooks / callbacks without making them depend on specific components of the store.
 */
export function usePlaygroundStore() {
  const store = useContext(PlaygroundContext);
  if (!store) throw new Error("Missing PlaygroundContext.Provider in the tree");
  return store;
}
