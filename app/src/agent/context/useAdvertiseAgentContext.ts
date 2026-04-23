import { useEffect, useRef } from "react";

import { useAgentStore } from "@phoenix/contexts/AgentContext";

import type { AgentContext } from "./agentContextTypes";

/**
 * Advertises a typed context from a mounted component to the agent store.
 *
 * Pass the current context (or `null` to clear). A unique mount id is
 * generated per hook instance so multiple components of the same type can
 * advertise concurrently without overwriting each other. The entry is
 * removed automatically on unmount.
 */
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
  }, [store, serialized]);

  useEffect(() => {
    const mountId = mountIdRef.current!;
    return () => {
      store.getState().removeMountedContext(mountId);
    };
  }, [store]);
}
