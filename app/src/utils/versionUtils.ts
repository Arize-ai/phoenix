/**
 * Parses the leading numeric release segments of a version string,
 * e.g. "11.10.0", "v11.10.0", or "11.10.0rc1" → [11, 10, 0].
 * Pre-release and dev suffixes are discarded.
 * @param version - the version string to parse
 * @returns the numeric segments, or null when the string does not start with a numeric segment
 */
export function parseVersion(version: string): number[] | null {
  const match = /^v?(\d+(?:\.\d+)*)/.exec(version.trim());
  if (!match) {
    return null;
  }
  return match[1].split(".").map(Number);
}

/**
 * Parses both `current` and `latest` version strings.
 * @returns a tuple of their parsed segments, or null when either cannot be parsed
 */
function parseVersionPair(
  current: string,
  latest: string
): [number[], number[]] | null {
  const currentSegments = parseVersion(current);
  const latestSegments = parseVersion(latest);
  if (currentSegments == null || latestSegments == null) {
    return null;
  }
  return [currentSegments, latestSegments];
}

/**
 * Determines whether `latest` is a strictly newer release than `current`.
 * Only numeric release segments are compared — pre-release suffixes are
 * ignored, so equal release numbers are never reported as newer.
 * @param params - the versions to compare
 * @param params.current - the version currently running
 * @param params.latest - the candidate newer version
 * @returns true when `latest` is newer; false when it is not or when either version cannot be parsed
 */
export function isVersionNewer({
  current,
  latest,
}: {
  current: string;
  latest: string;
}): boolean {
  const parsed = parseVersionPair(current, latest);
  if (parsed == null) {
    return false;
  }
  const [currentSegments, latestSegments] = parsed;
  const segmentCount = Math.max(currentSegments.length, latestSegments.length);
  for (let index = 0; index < segmentCount; index++) {
    const currentSegment = currentSegments[index] ?? 0;
    const latestSegment = latestSegments[index] ?? 0;
    if (latestSegment > currentSegment) {
      return true;
    }
    if (latestSegment < currentSegment) {
      return false;
    }
  }
  return false;
}

/**
 * Determines whether `latest` is meaningfully ahead of `current`: a newer
 * major release always qualifies, and within the same major line `latest`
 * must be at least `minorVersions` minor releases ahead. Patch bumps never
 * qualify.
 * @param params - the versions to compare
 * @param params.current - the version currently running
 * @param params.latest - the candidate newer version
 * @param params.minorVersions - the minimum minor-version distance within the same major line
 * @returns true when `latest` is ahead by at least the threshold; false otherwise or when either version cannot be parsed
 */
export function isVersionNewerBy({
  current,
  latest,
  minorVersions,
}: {
  current: string;
  latest: string;
  minorVersions: number;
}): boolean {
  const parsed = parseVersionPair(current, latest);
  if (parsed == null) {
    return false;
  }
  const [currentSegments, latestSegments] = parsed;
  const [currentMajor, currentMinor = 0] = currentSegments;
  const [latestMajor, latestMinor = 0] = latestSegments;
  if (latestMajor !== currentMajor) {
    return latestMajor > currentMajor;
  }
  return latestMinor - currentMinor >= minorVersions;
}

/**
 * Builds the GitHub release notes URL for an arize-phoenix version.
 * @param version - the phoenix version, e.g. "12.0.0"
 * @returns the URL of the GitHub release for that version
 */
export function getPhoenixReleaseNotesUrl(version: string): string {
  return `https://github.com/Arize-ai/phoenix/releases/tag/arize-phoenix-v${version}`;
}
