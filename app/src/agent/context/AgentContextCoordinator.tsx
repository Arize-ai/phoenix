import { useMemo } from "react";

import {
  deriveAgentContextsFromPageContext,
  dedupeAgentContexts,
} from "@phoenix/agent/context/agentContexts";
import { useCurrentAgentPageContext } from "@phoenix/agent/context/pageContext";
import { useAdvertiseAgentContextSource } from "@phoenix/agent/context/useAdvertiseAgentContextSource";

const ROUTE_AGENT_CONTEXT_SOURCE_KEY = "route";

export function AgentContextCoordinator() {
  const pageContext = useCurrentAgentPageContext();
  const routeContexts = useMemo(
    () => dedupeAgentContexts(deriveAgentContextsFromPageContext(pageContext)),
    [pageContext]
  );

  useAdvertiseAgentContextSource({
    sourceKey: ROUTE_AGENT_CONTEXT_SOURCE_KEY,
    contexts: routeContexts,
  });

  return null;
}
