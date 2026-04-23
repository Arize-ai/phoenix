import type { AgentState } from "@phoenix/store/agentStore";

import { agentContextKey, type AgentContext } from "./agentContextTypes";

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
