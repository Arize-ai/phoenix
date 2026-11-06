import { useEffect, useState } from "react";

import {
  subscribeToAgentDataChanges,
  type AgentDataChange,
} from "./agentDataChanges";

/**
 * Return a Relay fetchKey that advances when PXI changes a watched entity.
 * Pass a stable array (for example, a module-level constant) so the listener
 * is not replaced on every render.
 */
export function useAgentDataChangeFetchKey(
  entities: readonly AgentDataChange["entity"][]
): number {
  const [fetchKey, setFetchKey] = useState(0);

  useEffect(
    () =>
      subscribeToAgentDataChanges((change) => {
        if (entities.includes(change.entity)) {
          setFetchKey((key) => key + 1);
        }
      }),
    [entities]
  );

  return fetchKey;
}
