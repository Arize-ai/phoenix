import { useEffect, useMemo } from "react";
import { useMatches, useSearchParams } from "react-router";

import { useAgentStore } from "@phoenix/contexts/AgentContext";

import { deriveRouteContexts } from "./deriveRouteContexts";

/**
 * Listens to React Router state at the top of the authenticated tree and
 * keeps the agent store's `routeContexts` slice in sync with the typed
 * context set derived from the current page. Returns `null`.
 *
 * Lives at the top level so `useMatches()` sees every nested route match —
 * `useParams()` in a deeper tree would only expose its own level.
 */
export function AgentContextSync() {
  const store = useAgentStore();
  const matches = useMatches();
  const [searchParams] = useSearchParams();

  const next = useMemo(
    () => deriveRouteContexts(matches, searchParams),
    [matches, searchParams]
  );

  useEffect(() => {
    store.getState().setRouteContexts(next);
  }, [store, next]);

  return null;
}
