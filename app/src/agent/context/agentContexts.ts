import { SELECTED_SPAN_NODE_ID_PARAM } from "@phoenix/constants/searchParams";

import type { AgentPageContext } from "./pageContextTypes";

export type AgentContext =
  | {
      source: "route";
      type: "project";
      projectId: string;
    }
  | {
      source: "route";
      type: "trace";
      projectId: string;
      traceId: string;
    }
  | {
      source: "route";
      type: "span";
      projectId: string;
      traceId: string;
      spanNodeId: string;
    }
  | {
      source: "mounted";
      type: "span_filter_condition";
      projectId: string;
      filterCondition: string;
    };

const AGENT_CONTEXT_SOURCE_ORDER: Record<AgentContext["source"], number> = {
  route: 0,
  mounted: 1,
};

const AGENT_CONTEXT_TYPE_ORDER: Record<AgentContext["type"], number> = {
  project: 0,
  trace: 1,
  span: 2,
  span_filter_condition: 3,
};

function getSingleSearchParam({
  pageContext,
  key,
}: {
  pageContext: AgentPageContext;
  key: string;
}) {
  const value = pageContext.searchParams[key];

  return typeof value === "string" && value !== "" ? value : null;
}

export function getAgentContextKey(context: AgentContext) {
  switch (context.type) {
    case "project":
      return `${context.source}:${context.type}:${context.projectId}`;
    case "trace":
      return `${context.source}:${context.type}:${context.projectId}:${context.traceId}`;
    case "span":
      return `${context.source}:${context.type}:${context.projectId}:${context.traceId}:${context.spanNodeId}`;
    case "span_filter_condition":
      return `${context.source}:${context.type}:${context.projectId}:${context.filterCondition}`;
  }
}

export function compareAgentContexts(left: AgentContext, right: AgentContext) {
  return (
    AGENT_CONTEXT_SOURCE_ORDER[left.source] -
      AGENT_CONTEXT_SOURCE_ORDER[right.source] ||
    AGENT_CONTEXT_TYPE_ORDER[left.type] - AGENT_CONTEXT_TYPE_ORDER[right.type] ||
    getAgentContextKey(left).localeCompare(getAgentContextKey(right))
  );
}

export function sortAgentContexts(contexts: AgentContext[]) {
  return [...contexts].sort(compareAgentContexts);
}

export function dedupeAgentContexts(contexts: AgentContext[]) {
  const dedupedContexts = [
    ...new Map<string, AgentContext>(
      contexts.map((context) => [getAgentContextKey(context), context])
    ).values(),
  ];

  return sortAgentContexts(dedupedContexts);
}

export function areAgentContextListsEqual(
  left: AgentContext[],
  right: AgentContext[]
) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every(
    (context, index) => getAgentContextKey(context) === getAgentContextKey(right[index]!)
  );
}

export function mergeAgentContextSources(
  contextSources: Partial<Record<string, AgentContext[]>>
) {
  return dedupeAgentContexts(
    Object.values(contextSources).flatMap((contexts) => contexts ?? [])
  );
}

export function deriveAgentContextsFromPageContext(pageContext: AgentPageContext) {
  const projectId = pageContext.params.projectId;

  if (projectId == null) {
    return [];
  }

  const contexts: AgentContext[] = [
    {
      source: "route",
      type: "project",
      projectId,
    },
  ];
  const traceId = pageContext.params.traceId;

  if (traceId != null) {
    contexts.push({
      source: "route",
      type: "trace",
      projectId,
      traceId,
    });

    const spanNodeId = getSingleSearchParam({
      pageContext,
      key: SELECTED_SPAN_NODE_ID_PARAM,
    });

    if (spanNodeId != null) {
      contexts.push({
        source: "route",
        type: "span",
        projectId,
        traceId,
        spanNodeId,
      });
    }
  }

  return contexts;
}
