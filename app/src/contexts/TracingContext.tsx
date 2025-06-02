import { createContext, PropsWithChildren, useContext, useState } from "react";
import { useZustand } from "use-zustand";

import {
  createTracingStore,
  CreateTracingStoreProps,
  TracingState,
  TracingStore,
} from "@phoenix/store/tracingStore";

export const TracingContext = createContext<TracingStore | null>(null);

export function TracingProvider({
  children,
  ...props
}: PropsWithChildren<CreateTracingStoreProps>) {
  const [store] = useState<TracingStore>(() => createTracingStore(props));

  return (
    <TracingContext.Provider value={store}>{children}</TracingContext.Provider>
  );
}

export function useTracingContext<T>(
  selector: (state: TracingState) => T,
  equalityFn?: (left: T, right: T) => boolean
): T {
  const store = useContext(TracingContext);
  if (!store) throw new Error("Missing TracingContext.Provider in the tree");
  return useZustand(store, selector, equalityFn);
}
