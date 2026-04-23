import { useEffect, useRef } from "react";

import { useAgentStore } from "@phoenix/contexts/AgentContext";

import type { AgentContext } from "./agentContextTypes";

export function useAdvertiseAgentContext(context: AgentContext | null): void {
  const store = useAgentStore();
  const mountIdRef = useRef<string | null>(null);

  if (mountIdRef.current === null) {
    mountIdRef.current = crypto.randomUUID();
  }

  const serialized = context ? JSON.stringify(context) : null;

  useEffect(() => {
    const mountId = mountIdRef.current!;
    const parsed = serialized ? (JSON.parse(serialized) as AgentContext) : null;
    if (parsed) {
      store.getState().setMountedContext(mountId, parsed);
    } else {
      store.getState().removeMountedContext(mountId);
    }
  }, [serialized, store]);

  useEffect(() => {
    const mountId = mountIdRef.current!;
    return () => {
      store.getState().removeMountedContext(mountId);
    };
  }, [store]);
}
