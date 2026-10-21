import type { PropsWithChildren } from "react";
import { createContext, useContext, useState } from "react";
import { useZustand } from "use-zustand";

import type {
  CredentialsProps,
  CredentialsState,
  CredentialsStore,
} from "@phoenix/store/credentialsStore";
import { createCredentialsStore } from "@phoenix/store/credentialsStore";

export const CredentialsContext = createContext<CredentialsStore | null>(null);

export function CredentialsProvider({
  children,
  ...props
}: PropsWithChildren<Partial<CredentialsProps>>) {
  const [store] = useState<CredentialsStore>(() =>
    createCredentialsStore(props)
  );
  return (
    <CredentialsContext.Provider value={store}>
      {children}
    </CredentialsContext.Provider>
  );
}

/**
 * The credentials store itself, for reading the current credentials outside
 * of render (for example when a run starts) without subscribing to changes.
 */
export function useCredentialsStore(): CredentialsStore {
  const store = useContext(CredentialsContext);
  if (!store)
    throw new Error("Missing CredentialsContext.Provider in the tree");
  return store;
}

export function useCredentialsContext<T>(
  selector: (state: CredentialsState) => T,
  equalityFn?: (left: T, right: T) => boolean
): T {
  const store = useCredentialsStore();
  return useZustand(store, selector, equalityFn);
}
