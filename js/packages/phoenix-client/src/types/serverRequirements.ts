/**
 * Server capability requirements.
 *
 * A "capability" represents a specific server-side feature — such as an HTTP
 * route or query parameter — that is gated behind a minimum Phoenix server
 * version.  Each {@link CapabilityRequirement} declares *what* the capability
 * is and *which* server version first introduced it.
 *
 * The client checks these requirements at call time via
 * {@link ensureServerCapability} so that callers get a clear, actionable error
 * instead of an opaque 404 or 400 from an older server.
 */

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
