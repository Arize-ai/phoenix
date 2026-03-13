/**
 * Phoenix server version utilities.
 *
 * Provides guards for capabilities that require a minimum Phoenix **server**
 * version.  The server version is detected from the
 * `x-phoenix-server-version` response header or by calling
 * `GET /arize_phoenix_version`.
 */

import type { PhoenixClient } from "../client";
import type { CapabilityRequirement } from "../types/serverRequirements";
import { formatVersion, satisfiesMinVersion } from "./semverUtils";

// ---------------------------------------------------------------------------
// Capability label
// ---------------------------------------------------------------------------

/**
 * Derive a human-readable label from a structured capability requirement.
 * Uses `description` if provided, otherwise auto-derives from metadata.
 */
export function capabilityLabel(req: CapabilityRequirement): string {
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
 * Check the **Phoenix server version** before allowing a capability to proceed.
 *
 * Throws if the connected Phoenix server is older than the minimum version
 * required by the given capability. Does nothing if the server version cannot
 * be determined (to avoid blocking users on older servers).
 *
 * @example
 * ```ts
 * import { ensureServerCapability } from "../utils/serverVersionUtils";
 * import { GET_SESSION } from "../constants/serverRequirements";
 *
 * await ensureServerCapability({ client, requirement: GET_SESSION });
 * ```
 */
export async function ensureServerCapability({
  client,
  requirement,
}: {
  client: PhoenixClient;
  requirement: CapabilityRequirement;
}): Promise<void> {
  const version = await client.getServerVersion();
  if (!satisfiesMinVersion({ version, minVersion: requirement.minServerVersion })) {
    throw new Error(
      `${capabilityLabel(requirement)} requires Phoenix server >= ${formatVersion(requirement.minServerVersion)}, ` +
        `but connected to server ${formatVersion(version)}. Please upgrade your Phoenix server.`
    );
  }
}
