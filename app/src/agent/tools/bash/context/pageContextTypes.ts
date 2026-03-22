import type { InitialFiles } from "just-bash";

export type AgentContextRefreshReason = "navigation";

export type AgentPageKind = "generic" | "project" | "trace";

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
}

export interface AdapterMetadata {
  generatedAt: string;
  refreshReason: AgentContextRefreshReason;
  pathname: string;
  search: string;
  params: Record<string, string>;
  files: string[];
}

export interface AdapterResult {
  files: InitialFiles;
  metadata: AdapterMetadata;
  manifestFragment?: string;
}
