import type { PropsWithChildren } from "react";
import { createContext, useContext, useState } from "react";
import { useZustand } from "use-zustand";

import type {
  PromptsTableStore,
  PromptsTableStoreState,
} from "@phoenix/store/promptsTableStore";
import { createPromptsTableStore } from "@phoenix/store/promptsTableStore";

const PromptsTableContext = createContext<PromptsTableStore | null>(null);

export function PromptsTableProvider({ children }: PropsWithChildren) {
  const [store] = useState(createPromptsTableStore);
  return (
    <PromptsTableContext.Provider value={store}>
      {children}
    </PromptsTableContext.Provider>
  );
}

export function usePromptsTableContext<T>(
  selector: (state: PromptsTableStoreState) => T,
  equalityFn?: (left: T, right: T) => boolean
): T {
  const store = useContext(PromptsTableContext);
  if (store == null) {
    throw new Error("Missing PromptsTableContext.Provider in the tree");
  }
  return useZustand(store, selector, equalityFn);
}
