import type { PropsWithChildren } from "react";
import { createContext, useContext, useState } from "react";
import { useZustand } from "use-zustand";

import type {
  AnnotationConfigDraftStore,
  AnnotationConfigDraftStoreInstance,
  InitialAnnotationConfigDraftStoreProps,
} from "@phoenix/store/annotationConfigDraftStore";
import { createAnnotationConfigDraftStore } from "@phoenix/store/annotationConfigDraftStore";

export const AnnotationConfigDraftContext =
  createContext<AnnotationConfigDraftStoreInstance | null>(null);

export function AnnotationConfigDraftProvider({
  children,
  ...props
}: PropsWithChildren<InitialAnnotationConfigDraftStoreProps>) {
  const [store] = useState<AnnotationConfigDraftStoreInstance>(() =>
    createAnnotationConfigDraftStore(props)
  );
  return (
    <AnnotationConfigDraftContext.Provider value={store}>
      {children}
    </AnnotationConfigDraftContext.Provider>
  );
}

/** Access the raw store instance — for imperative reads/writes in handlers. */
export function useAnnotationConfigDraftStoreInstance() {
  const store = useContext(AnnotationConfigDraftContext);
  if (!store) {
    throw new Error("Missing AnnotationConfigDraftProvider in the tree");
  }
  return store;
}

/** Subscribe to a slice of the draft store. */
export function useAnnotationConfigDraftStore<T>(
  selector: (state: AnnotationConfigDraftStore) => T,
  equalityFn?: (left: T, right: T) => boolean
): T {
  const store = useAnnotationConfigDraftStoreInstance();
  return useZustand(store, selector, equalityFn);
}
