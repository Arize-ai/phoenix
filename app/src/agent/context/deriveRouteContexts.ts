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
