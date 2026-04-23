import type { AgentState } from "@phoenix/store/agentStore";

import { agentContextKey, type AgentContext } from "./agentContextTypes";

/**
 * Active contexts = route-derived contexts first, then mount-advertised
 * contexts. Deduped by {@link agentContextKey} so a mount-advertised entry
 * for the same logical entity does not appear twice. Later entries lose to
 * earlier ones, keeping route-order authoritative.
 */
export function selectActiveContexts(state: AgentState): AgentContext[] {
  const seen = new Set<string>();
  const result: AgentContext[] = [];
  const push = (context: AgentContext) => {
    const key = agentContextKey(context);
    if (seen.has(key)) return;
    seen.add(key);
    result.push(context);
  };
  for (const context of state.routeContexts) push(context);
  for (const context of Object.values(state.mountedContexts)) push(context);
  return result;
}
