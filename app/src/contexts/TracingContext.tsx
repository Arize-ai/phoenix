import type { PropsWithChildren } from "react";
import { createContext, useContext, useState } from "react";
import { useZustand } from "use-zustand";

import type {
  CreateTracingStoreProps,
  TracingState,
  TracingStore,
} from "@phoenix/store/tracingStore";
import { createTracingStore } from "@phoenix/store/tracingStore";

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

export function useTracingContext<SelectedValue>(
  selector: (state: TracingState) => SelectedValue,
  equalityFn?: (left: SelectedValue, right: SelectedValue) => boolean
): SelectedValue {
  const store = useContext(TracingContext);
  if (!store) throw new Error("Missing TracingContext.Provider in the tree");
  return useZustand(store, selector, equalityFn);
}
