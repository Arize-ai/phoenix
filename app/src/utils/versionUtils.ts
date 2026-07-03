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
  const currentSegments = parseVersion(current);
  const latestSegments = parseVersion(latest);
  if (currentSegments == null || latestSegments == null) {
    return false;
  }
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
