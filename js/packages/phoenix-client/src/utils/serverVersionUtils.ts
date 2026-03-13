/**
 * Phoenix server version utilities.
 *
 * Provides guards for features that require a minimum Phoenix **server**
 * version.  The server version is detected from the
 * `x-phoenix-server-version` response header or by calling
 * `GET /arize_phoenix_version`.
 */

import type { PhoenixClient } from "../client";
import type { FeatureRequirement } from "../types/serverRequirements";
import { formatVersion, satisfiesMinVersion } from "./semverUtils";

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
// Guards
// ---------------------------------------------------------------------------

/**
 * Check the **Phoenix server version** before allowing a feature to proceed.
 *
 * Throws if the connected Phoenix server is older than the minimum version
 * required by the given feature. Does nothing if the server version cannot
 * be determined (to avoid blocking users on older servers).
 *
 * @example
 * ```ts
 * import { ensureServerFeature } from "../utils/serverVersionUtils";
 * import { GET_SESSION } from "../constants/serverRequirements";
 *
 * await ensureServerFeature({ client, requirement: GET_SESSION });
 * ```
 */
export async function ensureServerFeature({
  client,
  requirement,
}: {
  client: PhoenixClient;
  requirement: FeatureRequirement;
}): Promise<void> {
  const version = await client.getServerVersion();
  if (!satisfiesMinVersion({ version, minVersion: requirement.minServerVersion })) {
    throw new Error(
      `${featureLabel(requirement)} requires Phoenix server >= ${formatVersion(requirement.minServerVersion)}, ` +
        `but connected to server ${formatVersion(version)}. Please upgrade your Phoenix server.`
    );
  }
}
