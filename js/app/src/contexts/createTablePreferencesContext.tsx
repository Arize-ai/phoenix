import type { PropsWithChildren } from "react";
import { createContext, useContext, useState } from "react";
import { useZustand } from "use-zustand";

import type {
  TablePreferencesState,
  TablePreferencesStore,
} from "@phoenix/store/tablePreferencesStore";
import { createTablePreferencesStore } from "@phoenix/store/tablePreferencesStore";

/**
 * Creates a provider and selector hook for one table's persisted column
 * preferences, so the table and the controls that configure it (a column
 * selector in a filter bar, say) can share a store without prop drilling.
 */
export function createTablePreferencesContext({
  name,
  storageKey,
}: {
  /** Name the store shows up under in redux devtools, and in the missing-provider error. */
  name: string;
  /** Local storage key the preferences persist to. */
  storageKey: string;
}) {
  const TablePreferencesContext = createContext<TablePreferencesStore | null>(
    null
  );

  function Provider({ children }: PropsWithChildren) {
    const [store] = useState(() =>
      createTablePreferencesStore({ name, storageKey })
    );
    return (
      <TablePreferencesContext.Provider value={store}>
        {children}
      </TablePreferencesContext.Provider>
    );
  }

  function useTablePreferences<T>(
    selector: (state: TablePreferencesState) => T,
    equalityFn?: (left: T, right: T) => boolean
  ): T {
    const store = useContext(TablePreferencesContext);
    if (store == null) {
      throw new Error(`Missing ${name} provider in the tree`);
    }
    return useZustand(store, selector, equalityFn);
  }

  return { Provider, useTablePreferences };
}
