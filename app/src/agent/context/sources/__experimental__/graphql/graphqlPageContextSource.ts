import type { AgentPageContext } from "@phoenix/agent/context/pageContextTypes";
import type {
  PageContextData,
  PageContextSource,
} from "@phoenix/agent/context/sources/types";

import {
  PROJECT_SESSIONS_QUERY,
  PROJECT_SPANS_QUERY,
  PROJECT_SUMMARY_QUERY,
  PROJECT_TRACES_QUERY,
  TRACE_CONTEXT_QUERY,
} from "./graphqlPageContextQueries";
import type {
  ProjectSessionsQueryData,
  ProjectSpansQueryData,
  ProjectSummaryQueryData,
  ProjectTracesQueryData,
  TimeRangeInput,
  TraceQueryData,
} from "./graphqlPageContextTypes";
import { fetchGraphQL } from "./graphqlTransport";

function toTimeRangeInput(
  timeRange: AgentPageContext["timeRange"]
): TimeRangeInput | null {
  if (!timeRange) {
    return null;
  }

  return {
    start: timeRange.start,
    end: timeRange.end,
  };
}

async function loadProjectContext(
  pageContext: AgentPageContext
): Promise<PageContextData> {
  const projectId = pageContext.projectId;

  if (!projectId) {
    throw new Error("Project page context is missing projectId");
  }

  const timeRange = toTimeRangeInput(pageContext.timeRange);
  const [summaryData, tracesData, spansData, sessionsData] = await Promise.all([
    fetchGraphQL<
      ProjectSummaryQueryData,
      { id: string; timeRange: TimeRangeInput | null }
    >(PROJECT_SUMMARY_QUERY, {
      id: projectId,
      timeRange,
    }),
    timeRange
      ? fetchGraphQL<
          ProjectTracesQueryData,
          { id: string; timeRange: TimeRangeInput }
        >(PROJECT_TRACES_QUERY, {
          id: projectId,
          timeRange,
        })
      : Promise.resolve({ project: null }),
    timeRange
      ? fetchGraphQL<
          ProjectSpansQueryData,
          { id: string; timeRange: TimeRangeInput }
        >(PROJECT_SPANS_QUERY, {
          id: projectId,
          timeRange,
        })
      : Promise.resolve({ project: null }),
    timeRange
      ? fetchGraphQL<
          ProjectSessionsQueryData,
          { id: string; timeRange: TimeRangeInput }
        >(PROJECT_SESSIONS_QUERY, {
          id: projectId,
          timeRange,
        })
      : Promise.resolve({ project: null }),
  ]);

  if (!summaryData.project) {
    throw new Error(`Project ${projectId} was not found`);
  }

  return {
    pageKind: "project",
    project: summaryData.project,
    traces: tracesData.project
      ? tracesData.project.rootSpans.edges.map(({ node }) => node)
      : [],
    spans: spansData.project
      ? spansData.project.spans.edges.map(({ node }) => node)
      : [],
    sessions: sessionsData.project
      ? sessionsData.project.sessions.edges.map(({ node }) => node)
      : [],
  };
}

async function loadTraceContext(
  pageContext: AgentPageContext
): Promise<PageContextData> {
  const projectId = pageContext.projectId;
  const traceId = pageContext.traceId;

  if (!projectId || !traceId) {
    throw new Error("Trace page context is missing projectId or traceId");
  }

  const data = await fetchGraphQL<
    TraceQueryData,
    { id: string; traceId: string }
  >(TRACE_CONTEXT_QUERY, {
    id: projectId,
    traceId,
  });

  if (!data.project) {
    throw new Error(`Project ${projectId} was not found`);
  }

  if (!data.project.trace) {
    throw new Error(`Trace ${traceId} was not found`);
  }

  return {
    pageKind: "trace",
    project: {
      id: data.project.id,
      name: data.project.name,
    },
    trace: {
      id: data.project.trace.id,
      projectSessionId: data.project.trace.projectSessionId,
      latencyMs: data.project.trace.latencyMs,
      costSummary: data.project.trace.costSummary,
      rootSpans: data.project.trace.rootSpans.edges.map(({ node }) => node),
    },
    spans: data.project.trace.spans.edges.map(({ node }) => node),
  };
}

export const graphqlPageContextSource: PageContextSource = {
  id: "experimental-graphql-page-context-source",
  async load(pageContext) {
    if (pageContext.pageKind === "project") {
      return loadProjectContext(pageContext);
    }

    if (pageContext.pageKind === "trace") {
      return loadTraceContext(pageContext);
    }

    return {
      pageKind: "generic",
    };
  },
};
