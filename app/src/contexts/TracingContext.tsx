import React, { createContext, PropsWithChildren, useState } from "react";
import { useZustand } from "use-zustand";

import {
  createTracingStore,
  TracingProps,
  TracingState,
  TracingStore,
} from "@phoenix/store/tracingStore";

export const TracingContext = createContext<TracingStore | null>(null);

export function TracingProvider({
  children,
  ...props
}: PropsWithChildren<Partial<TracingProps>>) {
  const [store] = useState<TracingStore>(() => createTracingStore(props));

  return (
    <TracingContext.Provider value={store}>{children}</TracingContext.Provider>
  );
}

export function useTracingContext<T>(
  selector: (state: TracingState) => T,
  equalityFn?: (left: T, right: T) => boolean
): T {
  const store = React.useContext(TracingContext);
  if (!store) throw new Error("Missing TracingContext.Provider in the tree");
  return useZustand(store, selector, equalityFn);
}
