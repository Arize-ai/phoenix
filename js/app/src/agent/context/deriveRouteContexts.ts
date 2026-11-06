import type { UIMatch } from "react-router";

import {
  SELECTED_SPAN_NODE_ID_PARAM,
  SELECTED_TRACE_ID_PARAM,
} from "@phoenix/constants/searchParams";
import { getTraceSelectionSlots } from "@phoenix/utils/traceSelectionUtils";

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
 * emitted in natural containment order: project → trace/session → span. The selected
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
  const sessionNodeId = params["sessionId"];
  const promptNodeId = params["promptId"];
  const promptVersionNodeId = params["versionId"];
  const routeSpanNodeId = params["spanId"];
  const selectedTraceId = searchParams.get(SELECTED_TRACE_ID_PARAM);
  // The viewed trace(s): one on the trace and session views, several on the
  // compare view, each with its own selected span.
  const traceSlots = getTraceSelectionSlots({
    routeTraceId: otelTraceId ?? selectedTraceId,
    searchParams,
  });
  // A span may also be selected with no trace in view (e.g. the playground)
  const spanNodeIds = traceSlots.flatMap(
    (slot) => slot.selectedSpanNodeId ?? []
  );
  if (spanNodeIds.length === 0) {
    const loneSpanNodeId =
      searchParams.get(SELECTED_SPAN_NODE_ID_PARAM) || routeSpanNodeId;
    if (loneSpanNodeId) {
      spanNodeIds.push(loneSpanNodeId);
    }
  }

  if (projectNodeId) {
    contexts.push({ type: "project", projectNodeId });
    for (const slot of traceSlots) {
      contexts.push({
        type: "trace",
        projectNodeId,
        otelTraceId: slot.traceId,
      });
    }
  }

  if (projectNodeId && sessionNodeId) {
    contexts.push({ type: "session", projectNodeId, sessionNodeId });
  }

  if (promptNodeId) {
    contexts.push({ type: "prompt", promptNodeId });
  }

  if (promptNodeId && promptVersionNodeId) {
    contexts.push({
      type: "prompt_version",
      promptNodeId,
      promptVersionNodeId,
    });
  }

  for (const spanNodeId of spanNodeIds) {
    contexts.push(
      projectNodeId
        ? { type: "span", projectNodeId, spanNodeId }
        : { type: "span", spanNodeId }
    );
  }

  return contexts;
}
