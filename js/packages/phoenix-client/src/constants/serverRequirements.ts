/**
 * Known server capability requirements.
 *
 * Each constant below describes a single Phoenix server capability — an HTTP
 * route or query parameter — together with the minimum server version that
 * supports it.  These constants are passed to
 * {@link ensureServerCapability} at call time to produce a clear error when
 * the connected server is too old.
 *
 * When a new version-gated capability is added to the Phoenix REST API, add a
 * corresponding requirement constant here and reference it from the client
 * function that uses it.
 */

import type {
  CapabilityRequirement,
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

export const GET_SPANS_FILTERS: ParameterRequirement = {
  kind: "parameter",
  parameterName: "span_kind",
  parameterLocation: "query",
  route: "GET /v1/projects/{id}/spans",
  minServerVersion: [13, 15, 0],
};

export const LIST_PROJECT_TRACES: RouteRequirement = {
  kind: "route",
  method: "GET",
  path: "/v1/projects/{project_identifier}/traces",
  minServerVersion: [13, 15, 0],
};

/**
 * Aggregate list of every known capability requirement.
 *
 * Useful for manifest scanning or startup diagnostics — iterate over this
 * array to check which capabilities the connected server supports.
 */
export const ALL_REQUIREMENTS: readonly CapabilityRequirement[] = [
  GET_SESSION,
  DELETE_SESSION,
  DELETE_SESSIONS,
  LIST_PROJECT_SESSIONS,
  ANNOTATE_SESSIONS,
  GET_SPANS_TRACE_IDS,
  GET_SPANS_FILTERS,
  LIST_PROJECT_TRACES,
] as const;
