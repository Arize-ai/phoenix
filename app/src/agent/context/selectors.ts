import type { AgentState } from "@phoenix/store/agentStore";

import { agentContextKey, type AgentContext } from "./agentContextTypes";

/**
 * Return the deduped, ordered list of contexts to advertise with the next
 * chat turn.
 *
 * Route contexts come first (they establish the page-level frame), then any
 * feature-level mounted contexts. Duplicates are collapsed by
 * {@link agentContextKey} so that, e.g., a project that appears in both
 * sources is only sent once.
 */
export function selectActiveContexts(state: AgentState): AgentContext[] {
  const seen = new Set<string>();
  const result: AgentContext[] = [];

  const push = (context: AgentContext) => {
    const key = agentContextKey(context);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    result.push(context);
  };

  for (const context of state.routeContexts) {
    push(context);
  }
  for (const context of Object.values(state.mountedContexts)) {
    push(context);
  }

  return result;
}
