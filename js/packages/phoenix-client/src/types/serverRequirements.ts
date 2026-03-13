import type { SemanticVersion } from "./semver";

export interface RouteRequirement {
  kind: "route";
  /** HTTP method (e.g. "GET", "POST", "DELETE"). */
  method: string;
  /** URL path template (e.g. "/v1/sessions/{session_id}"). */
  path: string;
  /** Minimum Phoenix server version as [major, minor, patch]. */
  minServerVersion: SemanticVersion;
  /** Optional human-readable description override. */
  description?: string;
}

export interface ParameterRequirement {
  kind: "parameter";
  /** Name of the query/path/header parameter. */
  parameterName: string;
  /** Location of the parameter (e.g. "query", "path", "header"). */
  parameterLocation: string;
  /** The route this parameter belongs to (e.g. "GET /v1/projects/{id}/spans"). */
  route: string;
  /** Minimum Phoenix server version as [major, minor, patch]. */
  minServerVersion: SemanticVersion;
  /** Optional human-readable description override. */
  description?: string;
}

export type CapabilityRequirement = RouteRequirement | ParameterRequirement;
