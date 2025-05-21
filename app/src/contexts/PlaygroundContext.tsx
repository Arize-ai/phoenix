import { createContext, PropsWithChildren, useContext, useState } from "react";
import { useZustand } from "use-zustand";

import {
  createPlaygroundStore,
  InitialPlaygroundState,
  PlaygroundState,
  PlaygroundStore,
} from "@phoenix/store";

export const PlaygroundContext = createContext<PlaygroundStore | null>(null);

export function PlaygroundProvider({
  children,
  ...props
}: PropsWithChildren<InitialPlaygroundState>) {
  const [store] = useState<PlaygroundStore>(() => createPlaygroundStore(props));
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
