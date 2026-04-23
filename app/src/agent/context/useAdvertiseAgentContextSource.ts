import { useEffect } from "react";

import { useAgentStore } from "@phoenix/contexts/AgentContext";

import type { AgentContext } from "./agentContexts";

export function useAdvertiseAgentContextSource({
  sourceKey,
  contexts,
}: {
  sourceKey: string;
  contexts: AgentContext[];
}) {
  const store = useAgentStore();

  useEffect(() => {
    store.getState().setContextSource(sourceKey, contexts);

    return () => {
      store.getState().clearContextSource(sourceKey);
    };
  }, [contexts, sourceKey, store]);
}
