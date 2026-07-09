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

import { parseEnvFile } from "./envFileParser";

export { parseEnvFile } from "./envFileParser";

/**
 * Name of the credential hand-off file discovered at (or above) the working
 * directory.
 */
export const PHOENIX_ENV_FILE_NAME = ".env.phoenix";

/**
 * Environment variable name for disabling `.env.phoenix` file discovery.
 * Discovery is on by default; set to "false" (or "0" / "no" / "off",
 * case-insensitive) to disable. Read from the process environment only — the
 * opt-out is intentionally never read from the file itself.
 * @example
 * process.env[ENV_PHOENIX_DISCOVER_CONFIG] = "false";
 */
export const ENV_PHOENIX_DISCOVER_CONFIG = "PHOENIX_DISCOVER_CONFIG";

const DISCOVERY_OPT_OUT_VALUES = new Set(["false", "0", "no", "off"]);

/**
 * Tracks which file paths have already triggered the permissive-permissions
 * warning so it is emitted at most once per file.
 */
const warnedPermissivePaths = new Set<string>();

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
      const isOwnedByCurrentUser =
        process.platform === "win32" ||
        typeof process.getuid !== "function" ||
        stats.uid === process.getuid();
      if (stats.isFile() && isOwnedByCurrentUser) {
        return candidate;
      }
    } catch {
      // Missing or unreadable candidate — keep walking up.
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return undefined;
    }
    currentDir = parentDir;
  }
}

/**
 * Emits a one-time warning (per file) if the file is group- or world-readable.
 * The file holds credentials, so it should only be readable by its owner.
 * Values are never logged. No-op on Windows, where POSIX mode bits are not
 * meaningful.
 */
function warnIfEnvFilePermissive(filePath: string): void {
  if (process.platform === "win32") {
    return;
  }
  if (warnedPermissivePaths.has(filePath)) {
    return;
  }
  let mode: number;
  try {
    mode = fs.statSync(filePath).mode;
  } catch {
    return;
  }
  const isReadableByOthers = (mode & 0o044) !== 0;
  if (isReadableByOthers) {
    warnedPermissivePaths.add(filePath);
    const permissions = (mode & 0o777).toString(8);
    // eslint-disable-next-line no-console
    console.warn(
      `${filePath} is readable by other users (mode 0${permissions}). ` +
        `It may contain credentials; consider restricting its permissions, ` +
        `e.g. \`chmod 600 ${filePath}\`.`
    );
  }
}

/**
 * Reads a Phoenix setting from the nearest `.env.phoenix` file.
 *
 * Returns `undefined` when the key is not `PHOENIX_`-prefixed, discovery is
 * disabled, no file is found, or the file cannot be read. Callers are expected
 * to consult the process environment first — the file is strictly a fallback.
 *
 * @param envKey - the environment variable name to look up
 * @param params - lookup parameters
 * @param params.startDir - directory to start the file discovery walk from
 *   (defaults to the current working directory)
 * @returns The value from the file, or `undefined` if not available.
 */
export function readEnvFileValue(
  envKey: string,
  {
    startDir = process.cwd(),
  }: {
    startDir?: string;
  } = {}
): string | undefined {
  if (!envKey.startsWith("PHOENIX_") || !isEnvFileDiscoveryEnabled()) {
    return undefined;
  }
  const filePath = findEnvFile({ startDir });
  if (!filePath) {
    return undefined;
  }
  let contents: string;
  try {
    contents = fs.readFileSync(filePath, "utf8");
  } catch {
    return undefined;
  }
  warnIfEnvFilePermissive(filePath);
  return parseEnvFile(contents)[envKey];
}

/**
 * Resets the one-time permissive-permissions warning latch.
 *
 * Intended for use in tests that need to exercise the warning path more than
 * once within the same module instance.
 *
 * @internal
 */
export function resetEnvFilePermissionWarningsForTesting(): void {
  warnedPermissivePaths.clear();
}
