import type {
  ProjectSessionRow,
  ProjectSpanRow,
  ProjectSummary,
  ProjectTraceRow,
  TraceRootSpan,
  TraceSpanRow,
  TraceSummary,
} from "@phoenix/agent/context/pageContextTypes";

export type GraphQLResponse<TData> = {
  data?: TData;
  errors?: Array<{ message: string }>;
};

export type TimeRangeInput = {
  start: string | null;
  end: string | null;
};

export type ProjectSummaryQueryData = {
  project: ({ __typename: "Project" } & ProjectSummary) | null;
};

export type ProjectTracesQueryData = {
  project: {
    __typename: "Project";
    rootSpans: { edges: Array<{ node: ProjectTraceRow }> };
  } | null;
};

export type ProjectSpansQueryData = {
  project: {
    __typename: "Project";
    spans: { edges: Array<{ node: ProjectSpanRow }> };
  } | null;
};

export type ProjectSessionsQueryData = {
  project: {
    __typename: "Project";
    sessions: { edges: Array<{ node: ProjectSessionRow }> };
  } | null;
};

export type TraceQueryData = {
  project: {
    __typename: "Project";
    id: string;
    name: string;
    trace: {
      id: string;
      projectSessionId: string | null;
      latencyMs: number | null;
      costSummary: TraceSummary["costSummary"];
      rootSpans: {
        edges: Array<{
          node: TraceRootSpan;
        }>;
      };
      spans: {
        edges: Array<{ node: TraceSpanRow }>;
      };
    } | null;
  } | null;
};
