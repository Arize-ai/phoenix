/**
 * Lightweight semantic version utilities.
 */

import type { SemanticVersion } from "../types/semver";

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Parse a semver-like version string (e.g. "13.14.0") into a triple.
 * Returns `null` if the string is not a valid version.
 */
export function parseSemanticVersion(raw: string): SemanticVersion | null {
  const parts = raw.trim().split(".");
  if (parts.length < 3) return null;
  const major = parseInt(parts[0]!, 10);
  const minor = parseInt(parts[1]!, 10);
  const patch = parseInt(parts[2]!, 10);
  if (
    Number.isNaN(major) ||
    Number.isNaN(minor) ||
    Number.isNaN(patch) ||
    major < 0 ||
    minor < 0 ||
    patch < 0
  ) {
    return null;
  }
  return [major, minor, patch];
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format a `SemanticVersion` as a `"major.minor.patch"` string.
 */
export function formatVersion(version: SemanticVersion): string {
  return `${version[0]}.${version[1]}.${version[2]}`;
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

/**
 * Returns `true` if `version` is greater than or equal to `minVersion`.
 */
export function satisfiesMinVersion({
  version,
  minVersion,
}: {
  version: SemanticVersion;
  minVersion: SemanticVersion;
}): boolean {
  const [serverVersionMajor, serverVersionMinor, serverVersionPatch] = version;
  const [minVersionMajor, minVersionMinor, minVersionPatch] = minVersion;
  if (serverVersionMajor !== minVersionMajor)
    return serverVersionMajor > minVersionMajor;
  if (serverVersionMinor !== minVersionMinor)
    return serverVersionMinor > minVersionMinor;
  return serverVersionPatch >= minVersionPatch;
}
