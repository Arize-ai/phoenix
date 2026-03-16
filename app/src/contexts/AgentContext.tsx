import type { PropsWithChildren } from "react";
import { createContext, useContext, useState } from "react";
import { useZustand } from "use-zustand";

import type {
  AgentProps,
  AgentState,
  AgentStore,
} from "@phoenix/store/agentStore";
import { createAgentStore } from "@phoenix/store/agentStore";

export const AgentContext = createContext<AgentStore | null>(null);

export function AgentProvider({
  children,
  ...props
}: PropsWithChildren<Partial<AgentProps>>) {
  const [store] = useState<AgentStore>(() => createAgentStore(props));

  return (
    <AgentContext.Provider value={store}>{children}</AgentContext.Provider>
  );
}

export function useAgentContext<T>(
  selector: (state: AgentState) => T,
  equalityFn?: (left: T, right: T) => boolean
): T {
  const store = useContext(AgentContext);
  if (!store) throw new Error("Missing AgentContext.Provider in the tree");
  return useZustand(store, selector, equalityFn);
}

export function useAgentStore(): AgentStore {
  const store = useContext(AgentContext);
  if (!store) throw new Error("Missing AgentContext.Provider in the tree");
  return store;
}
