import { readFileSync } from "node:fs";

const CLI_PACKAGE_NAME = "@arizeai/phoenix-cli";
const CLI_LATEST_VERSION_URL = `https://registry.npmjs.org/${encodeURIComponent(CLI_PACKAGE_NAME)}/latest`;
const DEFAULT_VERSION_CHECK_TIMEOUT_MS = 1500;
const DEFAULT_CLI_VERSION = "unknown";
const SEMANTIC_VERSION_PATTERN =
  /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

type SemanticVersion = {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
};

interface LatestVersionResponse {
  version?: unknown;
}

interface CliPackageJson {
  version?: unknown;
}

export interface CliVersionStatus {
  currentVersion: string;
  latestVersion?: string;
  hasUpdate?: boolean;
}

export interface FetchLatestPublishedCliVersionOptions {
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

function getPackageJsonVersion({
  packageJson,
}: {
  packageJson: CliPackageJson;
}): string | undefined {
  if (typeof packageJson.version !== "string") {
    return undefined;
  }

  const version = packageJson.version.trim();
  return version.length > 0 ? version : undefined;
}

function readCliVersionFromPackageJson(): string | undefined {
  try {
    const packageJson = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf-8")
    ) as CliPackageJson;

    return getPackageJsonVersion({ packageJson });
  } catch {
    return undefined;
  }
}

function readCliVersionFromEnvironment(): string | undefined {
  if (typeof process.env.npm_package_version !== "string") {
    return undefined;
  }

  const version = process.env.npm_package_version.trim();
  return version.length > 0 ? version : undefined;
}

export const CLI_VERSION =
  readCliVersionFromPackageJson() ??
  readCliVersionFromEnvironment() ??
  DEFAULT_CLI_VERSION;

/**
 * Returns the CLI version from package metadata.
 */
export function getCliVersion(): string {
  return CLI_VERSION;
}

/**
 * Parse a semver string so the CLI can compare local and published versions.
 */
export function parseSemanticVersion({
  rawVersion,
}: {
  rawVersion: string;
}): SemanticVersion | null {
  const match = rawVersion.trim().match(SEMANTIC_VERSION_PATTERN);
  if (!match) {
    return null;
  }

  return {
    major: Number.parseInt(match[1]!, 10),
    minor: Number.parseInt(match[2]!, 10),
    patch: Number.parseInt(match[3]!, 10),
    prerelease: match[4] || undefined,
  };
}

function comparePrereleaseSegments({
  leftPrerelease,
  rightPrerelease,
}: {
  leftPrerelease?: string;
  rightPrerelease?: string;
}): number {
  if (leftPrerelease === rightPrerelease) {
    return 0;
  }
  if (!leftPrerelease) {
    return 1;
  }
  if (!rightPrerelease) {
    return -1;
  }

  const leftSegments = leftPrerelease.split(".");
  const rightSegments = rightPrerelease.split(".");
  const segmentCount = Math.max(leftSegments.length, rightSegments.length);

  for (let index = 0; index < segmentCount; index += 1) {
    const leftSegment = leftSegments[index];
    const rightSegment = rightSegments[index];

    if (leftSegment === rightSegment) {
      continue;
    }
    if (leftSegment === undefined) {
      return -1;
    }
    if (rightSegment === undefined) {
      return 1;
    }

    const leftNumber = Number.parseInt(leftSegment, 10);
    const rightNumber = Number.parseInt(rightSegment, 10);
    const isLeftNumeric = String(leftNumber) === leftSegment;
    const isRightNumeric = String(rightNumber) === rightSegment;

    if (isLeftNumeric && isRightNumeric) {
      return leftNumber === rightNumber ? 0 : leftNumber > rightNumber ? 1 : -1;
    }
    if (isLeftNumeric) {
      return -1;
    }
    if (isRightNumeric) {
      return 1;
    }

    return leftSegment.localeCompare(rightSegment);
  }

  return 0;
}

/**
 * Compare two semantic versions.
 * Returns `1` when left is newer, `-1` when right is newer, and `0` when equal.
 */
export function compareSemanticVersions({
  leftVersion,
  rightVersion,
}: {
  leftVersion: string;
  rightVersion: string;
}): number | null {
  const leftParsedVersion = parseSemanticVersion({ rawVersion: leftVersion });
  const rightParsedVersion = parseSemanticVersion({ rawVersion: rightVersion });

  if (!leftParsedVersion || !rightParsedVersion) {
    return null;
  }

  if (leftParsedVersion.major !== rightParsedVersion.major) {
    return leftParsedVersion.major > rightParsedVersion.major ? 1 : -1;
  }
  if (leftParsedVersion.minor !== rightParsedVersion.minor) {
    return leftParsedVersion.minor > rightParsedVersion.minor ? 1 : -1;
  }
  if (leftParsedVersion.patch !== rightParsedVersion.patch) {
    return leftParsedVersion.patch > rightParsedVersion.patch ? 1 : -1;
  }

  return comparePrereleaseSegments({
    leftPrerelease: leftParsedVersion.prerelease,
    rightPrerelease: rightParsedVersion.prerelease,
  });
}

/**
 * Fetch the latest published CLI version from the npm registry.
 */
export async function fetchLatestPublishedCliVersion({
  fetchFn = fetch,
  timeoutMs = DEFAULT_VERSION_CHECK_TIMEOUT_MS,
}: FetchLatestPublishedCliVersionOptions = {}): Promise<string | undefined> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchFn(CLI_LATEST_VERSION_URL, {
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return undefined;
    }

    const payload = (await response.json()) as LatestVersionResponse;
    return typeof payload.version === "string" ? payload.version : undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Resolve the current CLI version and, when possible, the latest published version.
 */
export async function getCliVersionStatus({
  fetchFn,
  timeoutMs,
}: FetchLatestPublishedCliVersionOptions = {}): Promise<CliVersionStatus> {
  const currentVersion = getCliVersion();
  const latestVersion = await fetchLatestPublishedCliVersion({
    fetchFn,
    timeoutMs,
  });

  if (!latestVersion) {
    return { currentVersion };
  }

  const comparison = compareSemanticVersions({
    leftVersion: latestVersion,
    rightVersion: currentVersion,
  });

  if (comparison === null) {
    return { currentVersion };
  }

  return {
    currentVersion,
    latestVersion,
    hasUpdate: comparison > 0,
  };
}
