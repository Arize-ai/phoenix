import type {
  FeatureRequirement,
  ParameterRequirement,
  RouteRequirement,
} from "../types/serverRequirements";

export const GET_SESSION: RouteRequirement = {
  kind: "route",
  method: "GET",
  path: "/v1/sessions/{session_id}",
  minServerVersion: [13, 5, 0],
};

export const DELETE_SESSION: RouteRequirement = {
  kind: "route",
  method: "DELETE",
  path: "/v1/sessions/{session_id}",
  minServerVersion: [13, 13, 0],
};

export const DELETE_SESSIONS: RouteRequirement = {
  kind: "route",
  method: "POST",
  path: "/v1/sessions/delete",
  minServerVersion: [13, 13, 0],
};

export const LIST_PROJECT_SESSIONS: RouteRequirement = {
  kind: "route",
  method: "GET",
  path: "/v1/projects/{project_id}/sessions",
  minServerVersion: [13, 5, 0],
};

export const ANNOTATE_SESSIONS: RouteRequirement = {
  kind: "route",
  method: "POST",
  path: "/v1/session_annotations",
  minServerVersion: [12, 0, 0],
};

export const GET_SPANS_TRACE_IDS: ParameterRequirement = {
  kind: "parameter",
  parameterName: "trace_id",
  parameterLocation: "query",
  route: "GET /v1/projects/{id}/spans",
  minServerVersion: [13, 9, 0],
};

/** All feature requirements for manifest scanning. */
export const ALL_REQUIREMENTS: readonly FeatureRequirement[] = [
  GET_SESSION,
  DELETE_SESSION,
  DELETE_SESSIONS,
  LIST_PROJECT_SESSIONS,
  ANNOTATE_SESSIONS,
  GET_SPANS_TRACE_IDS,
] as const;
