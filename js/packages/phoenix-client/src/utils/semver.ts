/**
 * Lightweight semantic version utilities.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A semantic version triple: [major, minor, patch]. */
export type SemanticVersion = [number, number, number];

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Parse a semver-like version string (e.g. "13.14.0") into a triple.
 * Returns `null` if the string is not a valid version.
 */
export function parseSemanticVersion(raw: string): SemanticVersion | null {
  const parts = raw.trim().split(".").map(Number);
  if (parts.length >= 3 && parts.every(Number.isFinite)) {
    return [parts[0]!, parts[1]!, parts[2]!];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

/**
 * Returns `true` if `version` is greater than or equal to `minVersion`.
 */
export function satisfiesMinVersion(
  version: SemanticVersion,
  minVersion: SemanticVersion
): boolean {
  const [sMaj, sMin, sPat] = version;
  const [mMaj, mMin, mPat] = minVersion;
  if (sMaj !== mMaj) return sMaj > mMaj;
  if (sMin !== mMin) return sMin > mMin;
  return sPat >= mPat;
}
