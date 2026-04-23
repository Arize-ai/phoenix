import { useEffect, useMemo } from "react";
import { useMatches, useSearchParams } from "react-router";

import { useAgentStore } from "@phoenix/contexts/AgentContext";

import { deriveRouteContexts } from "./deriveRouteContexts";

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
