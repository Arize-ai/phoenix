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
 * expression from SpanFilterConditionField — into a single project context
 * with that field attached when present.
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
      // The route version usually carries no filter; SpanFilterConditionField
      // is the only source of the freeform `spanFilter` DSL expression, which
      // describes the view in full (root-span scoping included).
      byKey.set(key, {
        ...existing,
        ...context,
        spanFilter: context.spanFilter ?? existing.spanFilter,
      });
    }
    if (existing.type === "playground" && context.type === "playground") {
      // Two surfaces contribute one playground context: Playground.tsx owns the instances, PlaygroundDatasetSection the evaluator roster.
      byKey.set(key, {
        type: "playground",
        instances: context.instances?.length
          ? context.instances
          : existing.instances,
        evaluators: context.evaluators?.length
          ? context.evaluators
          : existing.evaluators,
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

/**
 * Return the active context of a given `type` (e.g. `"dataset"`, `"span"`), or
 * `undefined` if none is in scope. Narrows to the matching context variant.
 */
export function getActiveContext<T extends AgentContext["type"]>(
  state: AgentState,
  type: T
): Extract<AgentContext, { type: T }> | undefined {
  return selectActiveContexts(state).find(
    (context): context is Extract<AgentContext, { type: T }> =>
      context.type === type
  );
}
