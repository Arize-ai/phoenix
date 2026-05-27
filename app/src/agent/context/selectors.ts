import type { AgentState } from "@phoenix/store/agentStore";

import { agentContextKey, type AgentContext } from "./agentContextTypes";

/**
 * Return the deduped, ordered list of contexts to advertise with the next
 * chat turn.
 *
 * Route contexts come first (they establish the page-level frame), then any
 * feature-level mounted contexts. Duplicates are collapsed by
 * {@link agentContextKey}. Project entries are *merged* rather than dropped
 * so a route-derived project entry collapses with mounted project entries
 * that contribute spans-page state — the freeform `spanFilter` DSL
 * expression from SpanFilterConditionField and the `rootSpansOnly` boolean
 * toggle from SpansTable — into a single project context with both fields
 * attached when present.
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
      // Layer the mounted spans-page state onto the route-derived entry.
      // The route version usually carries neither field; mounted components
      // are the only source: SpanFilterConditionField advertises the
      // freeform `spanFilter` DSL expression, and SpansTable advertises the
      // `rootSpansOnly` toggle (a boolean for the root-vs-all-spans switch,
      // distinct from any condition in `spanFilter`).
      byKey.set(key, {
        ...existing,
        ...context,
        spanFilter: context.spanFilter ?? existing.spanFilter,
        rootSpansOnly: context.rootSpansOnly ?? existing.rootSpansOnly,
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
