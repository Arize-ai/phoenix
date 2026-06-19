import type { PropsWithChildren } from "react";
import { createContext, useContext, useState } from "react";
import { useZustand } from "use-zustand";

import type {
  PreferencesProps,
  PreferencesState,
  PreferencesStore,
} from "@phoenix/store/preferencesStore";
import { createPreferencesStore } from "@phoenix/store/preferencesStore";

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

export function usePreferencesContext<SelectedValue>(
  selector: (state: PreferencesState) => SelectedValue,
  equalityFn?: (left: SelectedValue, right: SelectedValue) => boolean
): SelectedValue {
  const store = useContext(PreferencesContext);
  if (!store)
    throw new Error("Missing PreferencesContext.Provider in the tree");
  return useZustand(store, selector, equalityFn);
}
