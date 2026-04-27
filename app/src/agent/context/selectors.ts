import type { AgentState } from "@phoenix/store/agentStore";

import { agentContextKey, type AgentContext } from "./agentContextTypes";

/**
 * Return the deduped, ordered list of contexts to advertise with the next
 * chat turn.
 *
 * Route contexts come first (they establish the page-level frame), then any
 * feature-level mounted contexts. Duplicates are collapsed by
 * {@link agentContextKey}. Project entries are *merged* rather than dropped
 * so a route-derived project (no spanFilter) and a mounted project entry
 * (carrying the active span filter) collapse into a single project context
 * with the spanFilter attached.
 */
export function selectActiveContexts(state: AgentState): AgentContext[] {
  const byKey = new Map<string, AgentContext>();
  const order: string[] = [];

  const upsert = (context: AgentContext) => {
    const key = agentContextKey(context);
    const existing = byKey.get(key);
    if (existing === undefined) {
      byKey.set(key, context);
      order.push(key);
      return;
    }
    if (existing.type === "project" && context.type === "project") {
      // Layer mounted spanFilter onto the route-derived entry. The route
      // version usually has no spanFilter; the mounted version is the only
      // source of the on-screen filter expression.
      byKey.set(key, {
        ...existing,
        ...context,
        spanFilter: context.spanFilter ?? existing.spanFilter,
      });
    }
  };

  for (const context of state.routeContexts) {
    upsert(context);
  }
  for (const context of Object.values(state.mountedContexts)) {
    upsert(context);
  }

  return order.map((key) => byKey.get(key) as AgentContext);
}
