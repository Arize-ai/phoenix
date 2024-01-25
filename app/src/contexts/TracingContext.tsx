import React, { createContext, PropsWithChildren, useRef } from "react";
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
  const storeRef = useRef<TracingStore>();
  if (!storeRef.current) {
    storeRef.current = createTracingStore(props);
  }
  return (
    <TracingContext.Provider value={storeRef.current}>
      {children}
    </TracingContext.Provider>
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
