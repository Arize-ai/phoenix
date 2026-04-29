/**
 * Settings storage schema definitions and runtime I/O for the Phoenix CLI.
 *
 * The Zod schemas in this file are the canonical source for
 * `schemas/phoenix-cli-settings.json` (emitted by `scripts/build-schema.ts`).
 * Runtime I/O (path resolution, file read/write, profile lookup) also lives
 * here so the module name matches the on-disk file (`settings.json`).
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { z } from "zod";

import { InvalidArgumentError } from "./exitCodes";

export const ProfileEntrySchema = z.object({
  endpoint: z
    .string()
    .optional()
    .describe(
      "Phoenix server URL this profile targets (e.g. https://app.phoenix.arize.com or http://localhost:6006)."
    ),
  apiKey: z
    .string()
    .optional()
    .describe(
      "API key sent as `Authorization: Bearer <apiKey>` with every request. Accepts both user and system API keys for self-hosted Phoenix and Phoenix Cloud. Treat as a secret — the profiles file should be user-readable only (mode 0600)."
    ),
  project: z
    .string()
    .optional()
    .describe(
      "Default Phoenix project name used when commands don't pass --project."
    ),
  headers: z
    .record(z.string(), z.string())
    .optional()
    .describe(
      "Extra HTTP headers sent with every request from this profile. Useful for custom auth or routing. Values override defaults."
    ),
});

export const SettingsFileSchema = z.object({
  $schema: z
    .string()
    .optional()
    .describe(
      "Optional JSON Schema URL for editor autocomplete. Pin to a GitHub raw URL at a released tag; see README."
    ),
  activeProfile: z
    .union([z.string(), z.null()])
    .describe(
      "Name of the profile to use when no --profile flag is passed. Must match a key in `profiles`."
    ),
  profiles: z
    .record(z.string(), ProfileEntrySchema)
    .describe(
      "Map of profile name to profile entry. Keys are the profile names referenced by `activeProfile` and the --profile flag."
    ),
});

/**
 * A single named profile entry. All fields are optional — a profile may
 * override only a subset of configuration values.
 */
export type ProfileEntry = z.infer<typeof ProfileEntrySchema>;

/**
 * On-disk schema for the CLI settings file.
 */
export type SettingsFile = z.infer<typeof SettingsFileSchema>;

/**
 * Result type returned by `parseSettingsFile`. Using a discriminated union
 * keeps parse errors explicit and avoids exceptions in the caller.
 */
type SettingsParseResult =
  | { ok: true; data: SettingsFile }
  | { ok: false; reason: string };

/**
 * Typed error thrown by `loadSettings({ strict: true })` when the settings
 * file is malformed or schema-invalid.
 */
export class SettingsFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SettingsFileError";
  }
}

/**
 * Typed error thrown when an explicitly requested profile (via `--profile`
 * or `PHOENIX_PROFILE`) does not resolve to an existing entry. Extends
 * `InvalidArgumentError` so `getExitCodeForError` maps it to
 * `ExitCode.INVALID_ARGUMENT` automatically.
 */
export class ProfileResolutionError extends InvalidArgumentError {
  constructor(message: string) {
    super(message);
    this.name = "ProfileResolutionError";
  }
}

/**
 * Empty settings state. Used as the initial value and as the fallback in
 * forgiving mode when the file is missing or corrupt.
 */
export const DEFAULT_SETTINGS_FILE: SettingsFile = {
  activeProfile: null,
  profiles: {},
};

/**
 * Format a Zod error path segment for human-readable messages.
 */
function formatZodPath(pathSegments: (string | number)[]): string {
  return pathSegments
    .map((segment, i) => {
      if (typeof segment === "number") {
        return `[${segment}]`;
      }
      return i === 0 ? segment : `.${segment}`;
    })
    .join("");
}

/**
 * Parse and validate a raw JSON string as a SettingsFile.
 *
 * Returns `{ ok: false, reason }` rather than throwing on any parse failure
 * so callers can decide whether to warn+continue or throw a typed error.
 */
function parseSettingsFile(rawJson: string): SettingsParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { ok: false, reason: "Invalid JSON in settings file" };
  }

  const result = SettingsFileSchema.safeParse(parsed);
  if (result.success) {
    return { ok: true, data: result.data };
  }

  const issue = result.error.issues[0];
  const issuePath = issue.path as (string | number)[];

  if (issuePath.length === 0) {
    return { ok: false, reason: "Settings file root must be an object" };
  }

  if (issuePath.length === 2 && issuePath[0] === "profiles") {
    const name = issuePath[1];
    return { ok: false, reason: `Profile "${name}" must be an object` };
  }

  if (issuePath.length === 3 && issuePath[0] === "profiles") {
    const name = issuePath[1];
    const field = issuePath[2];
    if (field === "headers") {
      return {
        ok: false,
        reason: `Profile "${name}".headers must be an object`,
      };
    }
    return {
      ok: false,
      reason: `Profile "${name}".${field} must be a string`,
    };
  }

  if (
    issuePath.length === 4 &&
    issuePath[0] === "profiles" &&
    issuePath[2] === "headers"
  ) {
    const name = issuePath[1];
    const key = issuePath[3];
    return {
      ok: false,
      reason: `Profile "${name}".headers["${key}"] must be a string`,
    };
  }

  if (issuePath[0] === "activeProfile") {
    return {
      ok: false,
      reason: "Settings file 'activeProfile' must be a string or null",
    };
  }

  if (issuePath[0] === "profiles") {
    return { ok: false, reason: "Settings file 'profiles' must be an object" };
  }

  return {
    ok: false,
    reason: `Invalid settings file at ${formatZodPath(issuePath)}: ${issue.message}`,
  };
}

/**
 * Return true if the profile name contains only alphanumeric characters,
 * hyphens, or underscores. Empty strings and names with whitespace or other
 * special characters are rejected.
 */
export function validateProfileName(name: string): boolean {
  if (!name || name.trim() !== name) {
    return false;
  }
  return /^[a-zA-Z0-9_-]+$/.test(name);
}

/**
 * Look up the active profile entry given a parsed settings file and an
 * optional profile name override.
 *
 * Resolution order:
 *   1. `overrideName` (from --profile flag or PHOENIX_PROFILE) if provided and found
 *   2. `file.activeProfile` if set and found
 *   3. `undefined` if no active profile resolves to an existing entry
 *
 * Returns `undefined` (rather than throwing) when the referenced name does
 * not exist in the profiles record — callers fall through to env vars / defaults.
 *
 * Returns both the name and entry together so callers never need to re-resolve
 * the name separately.
 */
export function getActiveProfile(
  file: SettingsFile,
  overrideName?: string
): { name: string; entry: ProfileEntry } | undefined {
  if (overrideName !== undefined) {
    const entry = file.profiles[overrideName];
    return entry !== undefined ? { name: overrideName, entry } : undefined;
  }
  if (file.activeProfile !== null) {
    const entry = file.profiles[file.activeProfile];
    return entry !== undefined
      ? { name: file.activeProfile, entry }
      : undefined;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// File I/O
// ---------------------------------------------------------------------------

/**
 * Return the Phoenix config directory. Respects `XDG_CONFIG_HOME` if set
 * (returns `$XDG_CONFIG_HOME/px`), otherwise falls back to `~/.px`.
 */
export function getConfigDir(): string {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  if (xdgConfigHome) {
    return path.join(xdgConfigHome, "px");
  }
  return path.join(os.homedir(), ".px");
}

/**
 * Return the absolute path to the settings config file.
 */
export function getSettingsPath(): string {
  return path.join(getConfigDir(), "settings.json");
}

export interface LoadSettingsOptions {
  /** When true, malformed JSON or schema-invalid content throws SettingsFileError. */
  strict?: boolean;
  /** Override the settings file path (used in tests). Defaults to getSettingsPath(). */
  settingsPath?: string;
}

/**
 * Load the settings file from disk.
 *
 * - Missing file: always returns `DEFAULT_SETTINGS_FILE` (not an error — no settings exist yet).
 * - Malformed JSON / schema-invalid, forgiving mode (default): returns `DEFAULT_SETTINGS_FILE`
 *   and writes a warning to stderr.
 * - Malformed JSON / schema-invalid, strict mode: throws `SettingsFileError`.
 */
export function loadSettings(options?: LoadSettingsOptions): SettingsFile {
  const strict = options?.strict ?? false;
  const filePath = options?.settingsPath ?? getSettingsPath();

  let rawJson: string;
  try {
    rawJson = fs.readFileSync(filePath, "utf-8");
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      (err as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return { ...DEFAULT_SETTINGS_FILE, profiles: {} };
    }
    if (strict) {
      throw err;
    }
    process.stderr.write(
      `Warning: Could not read settings file (${filePath}): ${String(err)}\n`
    );
    return { ...DEFAULT_SETTINGS_FILE, profiles: {} };
  }

  const result = parseSettingsFile(rawJson);
  if (result.ok) {
    return result.data;
  }

  if (strict) {
    throw new SettingsFileError(result.reason);
  }

  process.stderr.write(`Warning: ${result.reason}\n`);
  return { ...DEFAULT_SETTINGS_FILE, profiles: {} };
}

export interface SaveSettingsOptions {
  /** Override the settings file path (used in tests). Defaults to getSettingsPath(). */
  settingsPath?: string;
}

/**
 * Persist the settings file to disk.
 *
 * Creates the parent directory (and any ancestors) if it does not exist.
 * Writes human-readable JSON with 2-space indentation.
 */
export function saveSettings(
  data: SettingsFile,
  options?: SaveSettingsOptions
): void {
  const filePath = options?.settingsPath ?? getSettingsPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", {
    encoding: "utf-8",
    mode: 0o600,
  });
}
