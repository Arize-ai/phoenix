import { describe, expect, it } from "vitest";

import {
  deriveAgentContextsFromPageContext,
  mergeAgentContextSources,
} from "../agentContexts";
import type { AgentPageContext } from "../pageContextTypes";

describe("agentContexts", () => {
  it("derives project, trace, and selected span contexts from the route snapshot", () => {
    const pageContext: AgentPageContext = {
      pathname: "/projects/project-1/traces/trace-1",
      search: "?selectedSpanNodeId=span-1",
      params: {
        projectId: "project-1",
        traceId: "trace-1",
      },
      searchParams: {
        selectedSpanNodeId: "span-1",
      },
      routeMatches: [],
    };

    expect(deriveAgentContextsFromPageContext(pageContext)).toEqual([
      {
        source: "route",
        type: "project",
        projectId: "project-1",
      },
      {
        source: "route",
        type: "trace",
        projectId: "project-1",
        traceId: "trace-1",
      },
      {
        source: "route",
        type: "span",
        projectId: "project-1",
        traceId: "trace-1",
        spanNodeId: "span-1",
      },
    ]);
  });

  it("returns no route contexts when the current page is not project-scoped", () => {
    const pageContext: AgentPageContext = {
      pathname: "/settings",
      search: "",
      params: {},
      searchParams: {},
      routeMatches: [],
    };

    expect(deriveAgentContextsFromPageContext(pageContext)).toEqual([]);
  });

  it("deduplicates and orders aggregated contexts from multiple sources", () => {
    expect(
      mergeAgentContextSources({
        mounted: [
          {
            source: "mounted",
            type: "span_filter_condition",
            projectId: "project-1",
            filterCondition: "span_kind == 'LLM'",
          },
        ],
        route: [
          {
            source: "route",
            type: "trace",
            projectId: "project-1",
            traceId: "trace-1",
          },
          {
            source: "route",
            type: "project",
            projectId: "project-1",
          },
          {
            source: "route",
            type: "trace",
            projectId: "project-1",
            traceId: "trace-1",
          },
        ],
      })
    ).toEqual([
      {
        source: "route",
        type: "project",
        projectId: "project-1",
      },
      {
        source: "route",
        type: "trace",
        projectId: "project-1",
        traceId: "trace-1",
      },
      {
        source: "mounted",
        type: "span_filter_condition",
        projectId: "project-1",
        filterCondition: "span_kind == 'LLM'",
      },
    ]);
  });
});
