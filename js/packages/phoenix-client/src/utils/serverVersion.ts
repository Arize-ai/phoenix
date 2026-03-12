/**
 * Phoenix server version utilities.
 *
 * Provides types, constants, and guards for features that require a minimum
 * Phoenix **server** version.  The server version is detected from the
 * `x-phoenix-server-version` response header or by calling
 * `GET /arize_phoenix_version`.
 */

import type { PhoenixClient } from "../client";
import type { SemanticVersion } from "./semver";

export { parseSemanticVersion as parseServerVersion } from "./semver";
export type { SemanticVersion as ServerVersion } from "./semver";

export interface FeatureRequirement {
  /** Minimum Phoenix server version as [major, minor, patch]. */
  minVersion: SemanticVersion;
  /** Human-readable feature label used in error messages. */
  feature: string;
}

// ---------------------------------------------------------------------------
// Constants — minimum server versions for specific features
// ---------------------------------------------------------------------------

/** All `/v1/sessions` routes (get, list, delete, annotations, turns). */
export const SESSIONS_API: FeatureRequirement = {
  minVersion: [13, 14, 0],
  feature: "The sessions API routes (/v1/sessions)",
};

/** The `trace_ids` query parameter on `GET /v1/projects/{id}/spans`. */
export const TRACE_IDS_FILTER: FeatureRequirement = {
  minVersion: [13, 14, 0],
  feature: "The 'trace_ids' query parameter on the spans endpoint",
};

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
 * import { ensureServerFeature, SESSIONS_API } from "../utils/serverVersion";
 *
 * const ensureSessionsApi = ensureServerFeature(SESSIONS_API);
 *
 * // inside any session function:
 * await ensureSessionsApi({ client });
 * ```
 */
export function ensureServerFeature({
  minVersion,
  feature,
}: FeatureRequirement) {
  return async ({ client }: { client: PhoenixClient }): Promise<void> => {
    if (!(await client.supportsServerVersion(minVersion))) {
      const versionStr = client.serverVersion?.join(".") ?? "unknown";
      throw new Error(
        `${feature} requires Phoenix server >= ${minVersion.join(".")}, ` +
          `but connected to server ${versionStr}. Please upgrade your Phoenix server.`
      );
    }
  };
}

