/**
 * Merge an MCP server entry into an agent's project-scoped JSON config.
 *
 * A merge, never a rewrite: servers the user already has stay untouched, and
 * an existing entry under the same server name is replaced — which is what
 * makes a setup re-run idempotent. A file that exists but does not parse is
 * refused rather than clobbered; the caller degrades to the docs download.
 */

import * as fs from "node:fs";
import * as path from "node:path";

export interface WriteMcpConfigArgs {
  /**
   * Absolute path to the config file to merge into. Callers compose it from a
   * repo root or the user's home directory before calling — this function does
   * not join paths.
   */
  filePath: string;
  /**
   * How the path reads in the "could not be parsed" error: the repo-relative
   * path where the caller has one, else the absolute `filePath` (the default).
   */
  displayPath?: string;
  /**
   * JSON fragment to merge in: container and server-name keys merge, a
   * server entry itself is replaced wholesale.
   */
  patch: Record<string, unknown>;
  /**
   * Base content when the file does not exist yet (e.g. a `$schema` key).
   * An existing file is never back-filled with these — that would be editing
   * config the user didn't ask setup to touch.
   */
  createDefaults?: Record<string, unknown>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Both config shapes are container → server name → server config, so two
 * levels of key-sets merge and everything below is replaced. Merging deeper
 * would leave e.g. a `command` from an old stdio-style entry alongside the
 * new `url` — a hybrid the agent may resolve to the stale command.
 */
const MERGE_LEVELS = 2;

function mergeLevels(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
  levels: number
): Record<string, unknown> {
  const merged = { ...base };
  for (const [key, patchValue] of Object.entries(patch)) {
    const baseValue = merged[key];
    merged[key] =
      levels > 1 && isPlainObject(baseValue) && isPlainObject(patchValue)
        ? mergeLevels(baseValue, patchValue, levels - 1)
        : patchValue;
  }
  return merged;
}

/** Thrown when the target file exists but is not a JSON object. */
export class McpConfigUnreadableError extends Error {
  constructor(relativePath: string, detail: string) {
    super(`${relativePath} exists but could not be parsed (${detail})`);
    this.name = "McpConfigUnreadableError";
  }
}

export function writeMcpConfig({
  filePath,
  displayPath = filePath,
  patch,
  createDefaults,
}: WriteMcpConfigArgs): void {
  if (!path.isAbsolute(filePath)) {
    throw new Error("writeMcpConfig requires an absolute path");
  }

  let existing: Record<string, unknown> = createDefaults ?? {};
  if (fs.existsSync(filePath)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch (error) {
      throw new McpConfigUnreadableError(
        displayPath,
        error instanceof Error ? error.message : String(error)
      );
    }
    if (!isPlainObject(parsed)) {
      throw new McpConfigUnreadableError(displayPath, "not a JSON object");
    }
    existing = parsed;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  // Write-then-rename so a crash mid-write can never truncate a config the
  // user already had.
  const tempPath = `${filePath}.px-setup-tmp`;
  fs.writeFileSync(
    tempPath,
    `${JSON.stringify(mergeLevels(existing, patch, MERGE_LEVELS), null, 2)}\n`,
    "utf-8"
  );
  fs.renameSync(tempPath, filePath);
}
