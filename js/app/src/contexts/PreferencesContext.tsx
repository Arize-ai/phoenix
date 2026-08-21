import type { PropsWithChildren } from "react";
import { createContext, useContext, useEffect, useState } from "react";
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
  const isNativeScrollbarStylingEnabled = useZustand(
    store,
    (state) => state.isNativeScrollbarStylingEnabled
  );

  useEffect(() => {
    document.documentElement.toggleAttribute(
      "data-native-scrollbars",
      isNativeScrollbarStylingEnabled
    );
    return () => {
      document.documentElement.removeAttribute("data-native-scrollbars");
    };
  }, [isNativeScrollbarStylingEnabled]);

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
