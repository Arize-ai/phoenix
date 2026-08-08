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

export const OAuthTokensSchema = z.object({
  accessToken: z
    .string()
    .min(1)
    .describe(
      "OAuth access token used as a bearer token for Phoenix API requests."
    ),
  refreshToken: z
    .string()
    .min(1)
    .describe(
      "OAuth refresh token used to rotate the access token when it is near expiry."
    ),
  expiresAt: z
    .string()
    .datetime()
    .describe("ISO timestamp when the OAuth access token expires."),
  scope: z
    .string()
    .describe("OAuth scope string returned by the token endpoint."),
});

export const ProfileEntrySchema = z.object({
  // Deliberately looser than `validation/endpoint.ts`: one invalid field makes
  // a non-strict load discard every profile in the file (see `loadSettings`),
  // so an endpoint an older CLI was willing to write must not strand the
  // profiles sitting next to it.
  endpoint: z
    .string()
    .url(
      "endpoint must be an absolute URL (e.g. https://app.phoenix.arize.com or http://localhost:6006)"
    )
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
  oauthTokens: OAuthTokensSchema.optional().describe(
    "OAuth token pair created by `px auth login`. Tokens are secrets and are stored in the settings file with mode 0600."
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

export type OAuthTokens = z.infer<typeof OAuthTokensSchema>;

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
 * Typed error thrown when an explicitly requested profile (via `--profile`)
 * does not resolve to an existing entry. Extends `InvalidArgumentError` so
 * `getExitCodeForError` maps it to `ExitCode.INVALID_ARGUMENT` automatically.
 */
export class ProfileResolutionError extends InvalidArgumentError {
  constructor(message: string) {
    super(message);
    this.name = "ProfileResolutionError";
  }
}

/**
 * Default `$schema` URL written into newly-created settings files so editors
 * (VS Code, JetBrains, etc.) can validate and autocomplete out of the box.
 *
 * Pinned to `main` for now while the schema is still moving. We'll move it
 * to a SchemaStore entry once registered, and at that point this constant
 * becomes the fallback rather than the canonical pointer.
 */
export const DEFAULT_SCHEMA_URL =
  "https://raw.githubusercontent.com/Arize-ai/phoenix/main/schemas/phoenix-cli-settings.json";

/**
 * Empty settings state. Used as the forgiving-mode fallback when the file
 * exists but is unreadable or unparseable — see {@link getInitialSettingsFile}
 * for the freshly-created variant that includes `$schema`.
 */
export const DEFAULT_SETTINGS_FILE: SettingsFile = {
  activeProfile: null,
  profiles: {},
};

/**
 * Settings state used when no file exists yet. Differs from
 * {@link DEFAULT_SETTINGS_FILE} only in that it carries a `$schema` pointer,
 * so the very first `saveSettings` call writes a file editors can validate
 * without users having to add the line themselves. Any subsequent load
 * preserves whatever's already on disk — if a user removes `$schema`, we
 * don't put it back.
 */
export function getInitialSettingsFile(): SettingsFile {
  return {
    $schema: DEFAULT_SCHEMA_URL,
    activeProfile: null,
    profiles: {},
  };
}

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
    // For string-typed fields the underlying issue is either a type
    // mismatch ("must be a string") or a refinement failure (e.g. URL
    // validation on `endpoint`). Surface Zod's own message for refinement
    // failures so users see what actually went wrong.
    if (issue.code === "invalid_type") {
      return {
        ok: false,
        reason: `Profile "${name}".${field} must be a string`,
      };
    }
    return {
      ok: false,
      reason: `Profile "${name}".${field}: ${issue.message}`,
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
 * Look up a profile entry by name. Returns `undefined` (rather than
 * throwing) when the name does not exist in the profiles record so
 * callers can decide whether a miss is fatal (e.g. an explicit
 * `--profile` flag) or expected (e.g. a stale `activeProfile` pointer).
 *
 * Returns both the name and entry together so callers never need to
 * re-resolve the name separately.
 */
export function getProfileByName(
  file: SettingsFile,
  name: string
): { name: string; entry: ProfileEntry } | undefined {
  const entry = file.profiles[name];
  return entry !== undefined ? { name, entry } : undefined;
}

/**
 * Look up the profile pointed at by `file.activeProfile`. Returns
 * `undefined` when no active profile is set, or when the pointer is
 * stale (the named profile no longer exists). Stale-pointer handling
 * is forgiving by design — callers fall through to env vars / defaults
 * rather than failing.
 */
export function getStoredActiveProfile(
  file: SettingsFile
): { name: string; entry: ProfileEntry } | undefined {
  if (file.activeProfile === null) {
    return undefined;
  }
  return getProfileByName(file, file.activeProfile);
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
 * - Missing file: returns `getInitialSettingsFile()` — a fresh state that
 *   carries `$schema`, so the very first save writes a file editors can
 *   validate.
 * - Malformed JSON / schema-invalid, forgiving mode (default): returns
 *   `DEFAULT_SETTINGS_FILE` (no `$schema` — we don't want to clobber a user's
 *   intentional removal during a forgiving fallback) and writes a warning to
 *   stderr.
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
      return getInitialSettingsFile();
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
  // writeFileSync only applies `mode` when it creates the file; the file holds
  // secrets (API keys, OAuth tokens), so tighten a pre-existing permissive mode.
  fs.chmodSync(filePath, 0o600);
}
