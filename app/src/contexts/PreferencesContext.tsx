import React, { createContext, PropsWithChildren, useRef } from "react";
import { useZustand } from "use-zustand";

import {
  createPreferencesStore,
  PreferencesProps,
  PreferencesState,
  PreferencesStore,
} from "@phoenix/store/preferencesStore";

export const PreferencesContext = createContext<PreferencesStore | null>(null);

export function PreferencesProvider({
  children,
  ...props
}: PropsWithChildren<Partial<PreferencesProps>>) {
  const storeRef = useRef<PreferencesStore>();
  if (!storeRef.current) {
    storeRef.current = createPreferencesStore(props);
  }
  return (
    <PreferencesContext.Provider value={storeRef.current}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferencesContext<T>(
  selector: (state: PreferencesState) => T,
  equalityFn?: (left: T, right: T) => boolean
): T {
  const store = React.useContext(PreferencesContext);
  if (!store)
    throw new Error("Missing PreferencesContext.Provider in the tree");
  return useZustand(store, selector, equalityFn);
}
