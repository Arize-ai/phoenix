/**
 * Phoenix server version utilities.
 *
 * Provides types, constants, and guards for features that require a minimum
 * Phoenix **server** version.  The server version is detected from the
 * `x-phoenix-server-version` response header or by calling
 * `GET /arize_phoenix_version`.
 */

import type { PhoenixClient } from "../client";
import { satisfiesMinVersion } from "./semverUtils";
import type { SemanticVersion } from "./semverUtils";

export { parseSemanticVersion as parseServerVersion } from "./semverUtils";
export type { SemanticVersion as ServerVersion } from "./semverUtils";

// ---------------------------------------------------------------------------
// Discriminated union types
// ---------------------------------------------------------------------------

export interface RouteRequirement {
  kind: "route";
  /** HTTP method (e.g. "GET", "POST", "DELETE"). */
  method: string;
  /** URL path template (e.g. "/v1/sessions/{session_id}"). */
  path: string;
  /** Minimum Phoenix server version as [major, minor, patch]. */
  minVersion: SemanticVersion;
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
  minVersion: SemanticVersion;
  /** Optional human-readable description override. */
  description?: string;
}

export type FeatureRequirement = RouteRequirement | ParameterRequirement;

// ---------------------------------------------------------------------------
// Feature label
// ---------------------------------------------------------------------------

/**
 * Derive a human-readable label from a structured feature requirement.
 * Uses `description` if provided, otherwise auto-derives from metadata.
 */
export function featureLabel(req: FeatureRequirement): string {
  if (req.description) return req.description;
  switch (req.kind) {
    case "route":
      return `The ${req.method} ${req.path} route`;
    case "parameter":
      return `The '${req.parameterName}' ${req.parameterLocation} parameter on ${req.route}`;
  }
}

// ---------------------------------------------------------------------------
// Per-route constants
// ---------------------------------------------------------------------------

export const GET_SESSION: RouteRequirement = {
  kind: "route",
  method: "GET",
  path: "/v1/sessions/{session_id}",
  minVersion: [13, 14, 0],
};

export const DELETE_SESSION: RouteRequirement = {
  kind: "route",
  method: "DELETE",
  path: "/v1/sessions/{session_id}",
  minVersion: [13, 14, 0],
};

export const DELETE_SESSIONS: RouteRequirement = {
  kind: "route",
  method: "POST",
  path: "/v1/sessions/delete",
  minVersion: [13, 14, 0],
};

export const LIST_PROJECT_SESSIONS: RouteRequirement = {
  kind: "route",
  method: "GET",
  path: "/v1/projects/{project_id}/sessions",
  minVersion: [13, 14, 0],
};

export const ANNOTATE_SESSIONS: RouteRequirement = {
  kind: "route",
  method: "POST",
  path: "/v1/session_annotations",
  minVersion: [13, 14, 0],
};

export const GET_SPANS_TRACE_IDS: ParameterRequirement = {
  kind: "parameter",
  parameterName: "trace_ids",
  parameterLocation: "query",
  route: "GET /v1/projects/{id}/spans",
  minVersion: [13, 14, 0],
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

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

/**
 * Create a reusable guard that checks the **Phoenix server version** before
 * allowing a feature to proceed.
 *
 * Returns an async function that throws if the connected Phoenix server is
 * older than the minimum version required by the given feature.
 *
 * @example
 * ```ts
 * import { ensureServerFeature, GET_SESSION } from "../utils/serverVersionUtils";
 *
 * const ensureGetSession = ensureServerFeature(GET_SESSION);
 *
 * // inside any session function:
 * await ensureGetSession({ client });
 * ```
 */
export function ensureServerFeature(req: FeatureRequirement) {
  const label = featureLabel(req);
  return async ({ client }: { client: PhoenixClient }): Promise<void> => {
    const serverVersion = client.serverVersion;
    if (serverVersion === undefined) {
      // Version not yet known — try fetching it
      if (!(await client.supportsServerVersion(req.minVersion))) {
        const versionStr = client.serverVersion?.join(".") ?? "unknown";
        throw new Error(
          `${label} requires Phoenix server >= ${req.minVersion.join(".")}, ` +
            `but connected to server ${versionStr}. Please upgrade your Phoenix server.`
        );
      }
      return;
    }
    if (!satisfiesMinVersion(serverVersion, req.minVersion)) {
      const versionStr = serverVersion.join(".");
      throw new Error(
        `${label} requires Phoenix server >= ${req.minVersion.join(".")}, ` +
          `but connected to server ${versionStr}. Please upgrade your Phoenix server.`
      );
    }
  };
}
