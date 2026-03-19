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
  searchParams: Record<string, string | string[]>;
  routeMatches: Array<{
    id: string;
    pathname: string;
    params: Record<string, string>;
  }>;
  timeRange: AgentTimeRangeContext | null;
}

export interface AdapterMetadata {
  generatedAt: string;
  refreshReason: AgentContextRefreshReason;
  pathname: string;
  search: string;
  params: Record<string, string>;
  timeRange: AgentTimeRangeContext | null;
  files: string[];
}

export interface AdapterResult {
  files: InitialFiles;
  metadata: AdapterMetadata;
  manifestFragment?: string;
}
