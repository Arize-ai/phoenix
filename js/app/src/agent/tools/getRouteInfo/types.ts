import type { AgentRouteMetadata } from "./schemas";

export type GetRouteInfoInput = {
  query?: string;
  path?: string;
  limit: number;
};

export type RouteInfoHandle = {
  agentRoute?: unknown;
};

export type RouteCatalogEntry = {
  path: string;
  metadata: AgentRouteMetadata;
  routeIndex: number;
};

export type RouteInfoMatch = {
  path: string;
  label: string;
  description: string;
  link: string | null;
  missingParams: string[];
};

export type RouteInfoResult = {
  query?: string;
  path?: string;
  matches: RouteInfoMatch[];
};
