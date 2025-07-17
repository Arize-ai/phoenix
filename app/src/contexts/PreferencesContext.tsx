import { createContext, PropsWithChildren, useContext, useState } from "react";
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
  const [store] = useState<PreferencesStore>(() =>
    createPreferencesStore(props)
  );

  return (
    <PreferencesContext.Provider value={store}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferencesContext<T>(
  selector: (state: PreferencesState) => T,
  equalityFn?: (left: T, right: T) => boolean
): T {
  const store = useContext(PreferencesContext);
  if (!store)
    throw new Error("Missing PreferencesContext.Provider in the tree");
  return useZustand(store, selector, equalityFn);
}
