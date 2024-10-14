import React, { createContext, PropsWithChildren, useState } from "react";
import { useZustand } from "use-zustand";

import {
  createPlaygroundStore,
  PlaygroundProps,
  PlaygroundState,
  PlaygroundStore,
} from "@phoenix/store";

export const PlaygroundContext = createContext<PlaygroundStore | null>(null);

export function PlaygroundProvider({
  children,
  ...props
}: PropsWithChildren<Partial<PlaygroundProps>>) {
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
  const store = React.useContext(PlaygroundContext);
  if (!store) throw new Error("Missing PlaygroundContext.Provider in the tree");
  return useZustand(store, selector, equalityFn);
}
