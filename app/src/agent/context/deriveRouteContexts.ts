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
 * Build the ordered list of typed contexts that describe the user's current
 * page. Derivation is a pure function of the route matches + search params,
 * so it can be tested in isolation.
 *
 * Ordering: project → trace → span so that the merge against
 * mount-advertised contexts is stable and the UI pill row reads naturally.
 */
export function deriveRouteContexts(
  matches: UIMatch[],
  searchParams: URLSearchParams
): AgentContext[] {
  const params = collectRouteParams(matches);
  const contexts: AgentContext[] = [];

  const projectId = params["projectId"];
  const traceId = params["traceId"];
  const routeSpanId = params["spanId"];
  const selectedSpanNodeId = searchParams.get(SELECTED_SPAN_NODE_ID_PARAM);

  if (projectId) {
    contexts.push({ type: "project", projectId });
  }

  if (projectId && traceId) {
    contexts.push({ type: "trace", projectId, traceId });
  }

  if (selectedSpanNodeId) {
    contexts.push(
      projectId
        ? { type: "span", projectId, spanId: selectedSpanNodeId }
        : { type: "span", spanId: selectedSpanNodeId }
    );
  } else if (routeSpanId) {
    contexts.push({ type: "span", spanId: routeSpanId });
  }

  return contexts;
}
