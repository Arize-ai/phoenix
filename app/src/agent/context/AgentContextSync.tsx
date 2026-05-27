import { useEffect, useMemo } from "react";
import { useMatches, useSearchParams } from "react-router";

import { useAgentStore } from "@phoenix/contexts/AgentContext";

import { deriveRouteContexts } from "./deriveRouteContexts";

/**
 * Headless component that mirrors the current route (matches + search params)
 * into the agent store's `routeContexts` slice.
 *
 * Mounted once near the root so every navigation refreshes the contexts
 * advertised to the chat agent. Renders nothing; pair with
 * {@link ./useAdvertiseAgentContext.useAdvertiseAgentContext} for
 * feature-level contexts that cannot be derived from the route alone.
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
  }, [next, store]);

  return null;
}
