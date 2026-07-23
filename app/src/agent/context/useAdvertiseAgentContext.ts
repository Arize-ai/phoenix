import { useEffect, useRef } from "react";

import { useAgentStore } from "@phoenix/contexts/AgentContext";
import { generateUUID } from "@phoenix/utils/uuidUtils";

import type { AgentContext } from "./agentContextTypes";

/**
 * Advertise an {@link AgentContext} from a feature component for the
 * lifetime of that component.
 *
 * This is the escape hatch for contexts that cannot be derived from the
 * route alone — e.g. a span filter expression only becomes valid after async
 * validation. The hook assigns a stable per-mount id so multiple instances
 * of the same component each contribute independent entries to
 * `mountedContexts` in the agent store; passing `null` clears this mount's
 * entry. The context is always removed on unmount.
 *
 * Complements {@link ./AgentContextSync.AgentContextSync}, which handles the
 * route-level half of context advertisement.
 */
export function useAdvertiseAgentContext(context: AgentContext | null): void {
  const store = useAgentStore();
  const mountIdRef = useRef<string | null>(null);

  if (mountIdRef.current === null) {
    mountIdRef.current = generateUUID();
  }

  const serialized = context ? JSON.stringify(context) : null;

  useEffect(() => {
    const mountId = mountIdRef.current!;
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- round-trip of the AgentContext serialized above; shape is known
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
