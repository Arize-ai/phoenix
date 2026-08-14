import type { PropsWithChildren } from "react";
import { createContext, useContext, useState } from "react";
import { useZustand } from "use-zustand";

import type {
  AgentProps,
  AgentState,
  AgentStore,
} from "@phoenix/store/agentStore";
import { createAgentStore } from "@phoenix/store/agentStore";

/** React context that holds the Zustand agent store instance. */
export const AgentContext = createContext<AgentStore | null>(null);

/**
 * Provides the agent store to the component tree.
 *
 * The store is created once on mount using the supplied initial props
 * and remains stable for the lifetime of the provider.
 */
export function AgentProvider({
  children,
  ...props
}: PropsWithChildren<Partial<AgentProps>>) {
  const [store] = useState<AgentStore>(() => createAgentStore(props));

  return (
    <AgentContext.Provider value={store}>{children}</AgentContext.Provider>
  );
}

/**
 * Subscribes to a slice of the agent store using a selector.
 *
 * @param selector - Derives the value to return from the full agent state.
 * @param equalityFn - Optional custom equality check to avoid unnecessary re-renders.
 * @throws If called outside of an {@link AgentProvider}.
 */
export function useAgentContext<T>(
  selector: (state: AgentState) => T,
  equalityFn?: (left: T, right: T) => boolean
): T {
  const store = useContext(AgentContext);
  if (!store) throw new Error("Missing AgentContext.Provider in the tree");
  return useZustand(store, selector, equalityFn);
}

/**
 * Returns the raw Zustand store instance for imperative access
 * (e.g. calling actions outside of React render).
 *
 * @throws If called outside of an {@link AgentProvider}.
 */
export function useAgentStore(): AgentStore {
  const store = useContext(AgentContext);
  if (!store) throw new Error("Missing AgentContext.Provider in the tree");
  return store;
}
