/**
 * Discovery and parsing of the `.env.phoenix` credential hand-off file.
 *
 * When a Phoenix setting is not provided by explicit argument or process
 * environment variable, the nearest `.env.phoenix` file — found by walking up
 * from the current working directory toward the filesystem root — is consulted.
 * Precedence (highest wins): explicit arguments → process env vars → file. The
 * file never overrides anything already set.
 *
 * Only `PHOENIX_`-prefixed keys are read from the file; it is a Phoenix
 * hand-off artifact, not a general dotenv loader.
 *
 * @module
 */

import * as fs from "node:fs";
import * as path from "node:path";

import {
  ENV_PHOENIX_DISCOVER_CONFIG,
  parseEnvFile,
  PHOENIX_ENV_FILE_NAME,
} from "./envFileParser";

export {
  ENV_PHOENIX_DISCOVER_CONFIG,
  parseEnvFile,
  PHOENIX_ENV_FILE_NAME,
} from "./envFileParser";

const DISCOVERY_OPT_OUT_VALUES = new Set(["false", "0", "no", "off"]);

/**
 * Tracks which file paths have already triggered the permissive-permissions
 * warning so it is emitted at most once per file.
 */
const warnedPermissivePaths = new Set<string>();

/** Tracks candidate paths already reported as unusable. */
const warnedSkippedPaths = new Set<string>();

/**
 * Caches parsed file values per resolved working directory (an empty record
 * when no file exists), so each directory is walked and the file parsed at
 * most once per process.
 */
interface EnvFileEntry {
  filePath?: string;
  values: Partial<Record<string, string>>;
}

const envFileEntriesByDir = new Map<string, EnvFileEntry>();

/**
 * Whether `.env.phoenix` file discovery is enabled (the default). Disabled by
 * setting `PHOENIX_DISCOVER_CONFIG` to "false", "0", "no", or "off" in the
 * process environment.
 */
function isEnvFileDiscoveryEnabled(): boolean {
  const value = process.env[ENV_PHOENIX_DISCOVER_CONFIG];
  if (value == null) {
    return true;
  }
  return !DISCOVERY_OPT_OUT_VALUES.has(value.trim().toLowerCase());
}

/**
 * Whether the stats describe a regular file owned by the current user.
 */
function isTrustedEnvFileStats(stats: fs.Stats): boolean {
  const isOwnedByCurrentUser =
    process.platform === "win32" ||
    typeof process.getuid !== "function" ||
    stats.uid === process.getuid();
  return stats.isFile() && isOwnedByCurrentUser;
}

function warnIfEnvFileSkipped(filePath: string, reason: string): void {
  if (warnedSkippedPaths.has(filePath)) {
    return;
  }
  warnedSkippedPaths.add(filePath);
  // eslint-disable-next-line no-console
  console.warn(`Ignoring ${filePath}: ${reason}.`);
}

/**
 * Locates the nearest `.env.phoenix` file.
 *
 * Walks from `startDir` up toward the filesystem root and returns the first
 * match, or `undefined` if no file is found.
 *
 * @param params - discovery parameters
 * @param params.startDir - directory to start the walk from (defaults to the
 *   current working directory)
 * @returns The absolute path of the nearest `.env.phoenix` file, if any.
 */
export function findEnvFile({
  startDir = process.cwd(),
}: {
  startDir?: string;
} = {}): string | undefined {
  let currentDir = path.resolve(startDir);
  for (;;) {
    const candidate = path.join(currentDir, PHOENIX_ENV_FILE_NAME);
    try {
      const stats = fs.statSync(candidate);
      if (isTrustedEnvFileStats(stats)) {
        return candidate;
      }
      warnIfEnvFileSkipped(
        candidate,
        "file must be a regular file owned by the current user"
      );
    } catch (error) {
      if (
        !(error instanceof Error && "code" in error && error.code === "ENOENT")
      ) {
        warnIfEnvFileSkipped(candidate, "file could not be inspected");
      }
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return undefined;
    }
    currentDir = parentDir;
  }
}

/**
 * Emits a one-time warning (per file) if the file is readable or writable by
 * users other than its owner. The file holds credentials, so it should only be
 * accessible by its owner — write access by others is the injection vector for
 * redirecting traffic and credentials. Values are never logged. No-op on
 * Windows, where POSIX mode bits are not meaningful.
 */
function warnIfEnvFilePermissive(filePath: string, mode: number): void {
  if (process.platform === "win32") {
    return;
  }
  if (warnedPermissivePaths.has(filePath)) {
    return;
  }
  const isAccessibleByOthers = (mode & 0o066) !== 0;
  if (isAccessibleByOthers) {
    warnedPermissivePaths.add(filePath);
    const permissions = (mode & 0o777).toString(8);
    // eslint-disable-next-line no-console
    console.warn(
      `${filePath} is accessible by other users (mode 0${permissions}). ` +
        `It may contain credentials; consider restricting its permissions, ` +
        `e.g. \`chmod 600 ${filePath}\`.`
    );
  }
}

/**
 * Loads the values of the nearest `.env.phoenix` file, discovering and parsing
 * it at most once per working directory (the cache also remembers when no file
 * exists; call {@link clearEnvFileCache} to re-discover). A file that cannot be
 * read is treated as absent.
 */
function loadEnvFileEntry(): EnvFileEntry {
  const startDir = path.resolve(process.cwd());
  const cached = envFileEntriesByDir.get(startDir);
  if (cached) {
    return cached;
  }
  let values: Partial<Record<string, string>> = {};
  const filePath = findEnvFile({ startDir });
  if (filePath) {
    try {
      const fd = fs.openSync(filePath, "r");
      try {
        // Re-verify trust on the opened file descriptor so the content read
        // cannot differ from the file the ownership check saw.
        const stats = fs.fstatSync(fd);
        if (isTrustedEnvFileStats(stats)) {
          warnIfEnvFilePermissive(filePath, stats.mode);
          values = parseEnvFile(fs.readFileSync(fd, "utf8"));
        } else {
          warnIfEnvFileSkipped(
            filePath,
            "opened file must be a regular file owned by the current user"
          );
        }
      } finally {
        fs.closeSync(fd);
      }
    } catch {
      warnIfEnvFileSkipped(filePath, "file could not be read");
    }
  }
  const entry = { filePath, values };
  envFileEntriesByDir.set(startDir, entry);
  return entry;
}

export interface EnvFileValue {
  filePath: string;
  value: string;
}

/** Reads a file value together with the path that supplied it. */
export function readEnvFileValueWithPath(
  envKey: string
): EnvFileValue | undefined {
  if (!envKey.startsWith("PHOENIX_") || !isEnvFileDiscoveryEnabled()) {
    return undefined;
  }
  const { filePath, values } = loadEnvFileEntry();
  const value = values[envKey];
  return filePath && value !== undefined ? { filePath, value } : undefined;
}

/**
 * Reads a Phoenix setting from the nearest `.env.phoenix` file.
 *
 * Returns `undefined` when the key is not `PHOENIX_`-prefixed, discovery is
 * disabled, no file is found, or the file cannot be read. Callers are expected
 * to consult the process environment first — the file is strictly a fallback.
 *
 * @param envKey - the environment variable name to look up
 * @returns The value from the file, or `undefined` if not available.
 */
export function readEnvFileValue(envKey: string): string | undefined {
  return readEnvFileValueWithPath(envKey)?.value;
}

/**
 * Clears cached `.env.phoenix` discovery results.
 *
 * Discovery results (including the absence of a file) are cached per working
 * directory for the lifetime of the process. Long-running processes (e.g.
 * notebooks) that create or change a `.env.phoenix` file after the first
 * configuration lookup can call this to make subsequent lookups re-discover
 * the file.
 */
export function clearEnvFileCache(): void {
  envFileEntriesByDir.clear();
  warnedPermissivePaths.clear();
  warnedSkippedPaths.clear();
}
