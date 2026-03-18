import type { InitialFiles } from "just-bash";

export type AgentContextRefreshReason =
  | "navigation"
  | "time-range-change"
  | "manual";

export type AgentPageKind = "generic" | "project" | "trace";

export interface AgentTimeRangeContext {
  timeRangeKey: string | null;
  start: string | null;
  end: string | null;
}

export interface AgentPageContext {
  pathname: string;
  search: string;
  params: Record<string, string>;
  pageKind: AgentPageKind;
  projectId: string | null;
  traceId: string | null;
  projectTab: string | null;
  timeRange: AgentTimeRangeContext | null;
}

export interface AdapterMetadata {
  adapterId: string;
  adapterName: string;
  generatedAt: string;
  refreshReason: AgentContextRefreshReason;
  pathname: string;
  search: string;
  pageKind: AgentPageKind;
  projectId: string | null;
  traceId: string | null;
  projectTab: string | null;
  timeRange: AgentTimeRangeContext | null;
  files: string[];
}

export interface AdapterResult {
  files: InitialFiles;
  metadata: AdapterMetadata;
  manifestFragment?: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  traceCount: number | null;
  spanCount: number | null;
}

export interface ProjectTraceRow {
  id: string;
  spanId: string;
  name: string;
  spanKind: string;
  statusCode: string;
  startTime: string | null;
  endTime: string | null;
  latencyMs: number | null;
  cumulativeTokenCountTotal: number | null;
  input: { value: string | null } | null;
  output: { value: string | null } | null;
  trace: {
    id: string;
    traceId: string;
    numSpans: number | null;
    costSummary: { total: { cost: number | null } | null } | null;
  };
}

export interface ProjectSpanRow {
  id: string;
  spanId: string;
  name: string;
  spanKind: string;
  statusCode: string;
  startTime: string | null;
  latencyMs: number | null;
  tokenCountTotal: number | null;
  cumulativeTokenCountTotal: number | null;
  input: { value: string | null } | null;
  output: { value: string | null } | null;
  trace: {
    id: string;
    traceId: string;
    costSummary: { total: { cost: number | null } | null } | null;
  };
}

export interface ProjectSessionRow {
  id: string;
  sessionId: string;
  numTraces: number | null;
  startTime: string | null;
  endTime: string | null;
  firstInput: { value: string | null } | null;
  lastOutput: { value: string | null } | null;
  tokenUsage: { total: number | null } | null;
  traceLatencyMsP50: number | null;
  traceLatencyMsP99: number | null;
  costSummary: { total: { cost: number | null } | null } | null;
}

export interface TraceRootSpan {
  id: string;
  spanId: string;
  parentId: string | null;
  statusCode: string;
}

export interface TraceSummary {
  id: string;
  projectSessionId: string | null;
  latencyMs: number | null;
  costSummary: {
    prompt: { cost: number | null } | null;
    completion: { cost: number | null } | null;
    total: { cost: number | null } | null;
  } | null;
  rootSpans: TraceRootSpan[];
}

export interface TraceSpanRow {
  id: string;
  spanId: string;
  name: string;
  spanKind: string;
  statusCode: string;
  startTime: string | null;
  endTime: string | null;
  parentId: string | null;
  latencyMs: number | null;
  tokenCountTotal: number | null;
}
