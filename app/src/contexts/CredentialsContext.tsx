import { createContext, PropsWithChildren, useContext, useState } from "react";
import { useZustand } from "use-zustand";

import {
  createCredentialsStore,
  CredentialsProps,
  CredentialsState,
  CredentialsStore,
} from "@phoenix/store";

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

export function useCredentialsContext<T>(
  selector: (state: CredentialsState) => T,
  equalityFn?: (left: T, right: T) => boolean
): T {
  const store = useContext(CredentialsContext);
  if (!store)
    throw new Error("Missing CredentialsContext.Provider in the tree");
  return useZustand(store, selector, equalityFn);
}
