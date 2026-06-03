import type { UIMatch } from "react-router";

import { SELECTED_SPAN_NODE_ID_PARAM } from "@phoenix/constants/searchParams";

import type { AgentContext } from "./agentContextTypes";

function collectRouteParams(matches: UIMatch[]): Record<string, string> {
  return matches.reduce<Record<string, string>>((params, match) => {
    return {
      ...params,
      ...Object.fromEntries(
        Object.entries(match.params).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string"
        )
      ),
    };
  }, {});
}

/**
 * Derive the ordered list of {@link AgentContext}s implied by the current
 * route and URL.
 *
 * Route params are flattened across all matched routes, and contexts are
 * emitted in natural containment order: project → trace → span. The selected
 * span search param (from the spans table) takes precedence over a `spanId`
 * in the route, since it reflects the user's most recent selection.
 *
 * Used by {@link ./AgentContextSync.AgentContextSync} to keep the agent
 * store's `routeContexts` slice in sync with navigation.
 */
export function deriveRouteContexts(
  matches: UIMatch[],
  searchParams: URLSearchParams
): AgentContext[] {
  const params = collectRouteParams(matches);
  const contexts: AgentContext[] = [];

  // The `:projectId` route segment carries a Phoenix relay node ID; the
  // `:traceId` segment carries an OpenTelemetry hex trace ID; the
  // `:spanId` segment (used by /playground/spans/:spanId) carries a Phoenix
  // relay node ID, as does the `?selectedSpanNodeId=` search param. See
  // agentContextTypes.ts for the format conventions.
  const projectNodeId = params["projectId"];
  const otelTraceId = params["traceId"];
  const routeSpanNodeId = params["spanId"];
  const selectedSpanNodeId = searchParams.get(SELECTED_SPAN_NODE_ID_PARAM);

  if (projectNodeId) {
    contexts.push({ type: "project", projectNodeId });
  }

  if (projectNodeId && otelTraceId) {
    contexts.push({ type: "trace", projectNodeId, otelTraceId });
  }

  if (selectedSpanNodeId) {
    contexts.push(
      projectNodeId
        ? { type: "span", projectNodeId, spanNodeId: selectedSpanNodeId }
        : { type: "span", spanNodeId: selectedSpanNodeId }
    );
  } else if (routeSpanNodeId) {
    contexts.push(
      projectNodeId
        ? { type: "span", projectNodeId, spanNodeId: routeSpanNodeId }
        : { type: "span", spanNodeId: routeSpanNodeId }
    );
  }

  return contexts;
}
