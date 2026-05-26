import { useEffect, useRef } from "react";

import { useAgentStore } from "@phoenix/contexts/AgentContext";
import { generateUUID } from "@phoenix/utils/uuidUtils";

/**
 * Register a dataset surface's `DatasetEvaluatorEdge` Relay connection ID
 * with the agent store so the create-evaluator commit handler can snapshot
 * the union of registered IDs at propose time and pass them to
 * `createDatasetCodeEvaluator` for `@appendNode`.
 *
 * Multiple surfaces can register simultaneously (e.g. dataset detail page +
 * experiment compare pages); each call gets its own per-mount UUID so the
 * entries don't collide. Passing `null` clears this mount's entry; the hook
 * always removes the entry on unmount.
 */
export function useAdvertiseAgentEvaluatorConnections(
  value: { datasetEvaluatorConnectionId: string } | null
): void {
  const store = useAgentStore();
  const mountIdRef = useRef<string | null>(null);

  if (mountIdRef.current === null) {
    mountIdRef.current = generateUUID();
  }

  const serialized = value ? JSON.stringify(value) : null;

  useEffect(() => {
    const mountId = mountIdRef.current!;
    const parsed = serialized
      ? (JSON.parse(serialized) as { datasetEvaluatorConnectionId: string })
      : null;
    store.getState().setDatasetEvaluatorConnectionId(mountId, parsed);
  }, [serialized, store]);

  useEffect(() => {
    const mountId = mountIdRef.current!;
    return () => {
      store.getState().setDatasetEvaluatorConnectionId(mountId, null);
    };
  }, [store]);
}
