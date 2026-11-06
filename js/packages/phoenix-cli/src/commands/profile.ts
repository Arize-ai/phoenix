import { spawnSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Command } from "commander";

import { ExitCode } from "../exitCodes";
import { writeError, writeOutput, writeProgress } from "../io";
import { collectString } from "../optionParsers";
import {
  type ProfileEntry,
  type SettingsFile,
  ProfileEntrySchema,
  SettingsFileError,
  getStoredActiveProfile,
  loadSettings,
  saveSettings,
  validateProfileName,
} from "../settings";
import { ENDPOINT_REQUIREMENT, isEndpointUrl } from "../validation/endpoint";
import {
  type OutputFormat,
  type ProfileListEntry,
  formatProfilesOutput,
} from "./formatProfiles";
import type { ConfirmationOptions } from "./options";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildProfileListEntries(file: SettingsFile): ProfileListEntry[] {
  const activeName = getStoredActiveProfile(file)?.name;
  return Object.entries(file.profiles).map(([name, entry]) =>
    buildSingleProfileEntry(name, entry, name === activeName)
  );
}

function buildSingleProfileEntry(
  name: string,
  entry: ProfileEntry,
  active: boolean
): ProfileListEntry {
  return {
    name,
    endpoint: entry.endpoint,
    project: entry.project,
    hasApiKey: entry.apiKey !== undefined && entry.apiKey.length > 0,
    headers: entry.headers,
    active,
  };
}

/**
 * Load settings in strict mode. On any parse / I/O error, write the failure
 * to stderr and exit with `ExitCode.FAILURE`. Mutation commands all share
 * this preamble so a corrupt settings file fails loudly instead of silently
 * overwriting whatever's on disk.
 */
function loadSettingsStrictOrExit(): SettingsFile {
  try {
    return loadSettings({ strict: true });
  } catch (err) {
    if (err instanceof SettingsFileError) {
      writeError({ message: `Error reading settings file: ${err.message}` });
      process.exit(ExitCode.FAILURE);
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// list
// ---------------------------------------------------------------------------

/**
 * Options for `px profile list`. Reads the local settings file only — no API
 * call is made — so this does not extend the shared connection bases.
 */
interface ProfileListOptions {
  /**
   * `--format <format>`: How the profile list is rendered on stdout —
   * `pretty` (default), `json`, or `raw`.
   *
   * @example "json"
   */
  format?: OutputFormat;
}

async function profileListHandler(options: ProfileListOptions): Promise<void> {
  const file = loadSettings();
  const entries = buildProfileListEntries(file);
  const output = formatProfilesOutput({
    profiles: entries,
    format: options.format,
  });
  writeOutput({ message: output });
}

function createProfileListCommand(): Command {
  return new Command("list")
    .description("List all profiles")
    .option(
      "--format <format>",
      'Output format: pretty, json, or raw (default: "pretty")'
    )
    .action(profileListHandler);
}

// ---------------------------------------------------------------------------
// show
// ---------------------------------------------------------------------------

/**
 * Options for `px profile show`. Reads the local settings file only — no API
 * call is made — so this does not extend the shared connection bases.
 */
interface ProfileShowOptions {
  /**
   * `--format <format>`: How the profile is rendered on stdout — `pretty`
   * (default), `json`, or `raw`.
   *
   * @example "raw"
   */
  format?: OutputFormat;
}

async function profileShowHandler(
  name: string | undefined,
  options: ProfileShowOptions
): Promise<void> {
  const file = loadSettings();

  let resolvedName: string | undefined;
  if (name !== undefined) {
    resolvedName = name;
  } else {
    resolvedName = getStoredActiveProfile(file)?.name;
  }

  if (resolvedName === undefined) {
    writeError({
      message:
        "No active profile. Use `px profile use <name>` to set one, or pass a profile name.",
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }

  const entry = file.profiles[resolvedName];
  if (entry === undefined) {
    writeError({ message: `Profile "${resolvedName}" does not exist.` });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }

  const activeName = getStoredActiveProfile(file)?.name;
  const profileEntry = buildSingleProfileEntry(
    resolvedName,
    entry,
    resolvedName === activeName
  );
  const output = formatProfilesOutput({
    profiles: profileEntry,
    format: options.format,
  });
  writeOutput({ message: output });
}

function createProfileShowCommand(): Command {
  return new Command("show")
    .description("Show a profile (defaults to the current profile)")
    .argument("[name]", "Profile name (defaults to the current active profile)")
    .option(
      "--format <format>",
      'Output format: pretty, json, or raw (default: "pretty")'
    )
    .action(profileShowHandler);
}

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

/**
 * Options for `px profile create`. This writes to the local settings file
 * rather than calling the Phoenix API, so it does not extend the shared
 * connection bases either — `endpoint`/`apiKey`/`project` here are values to
 * store on the new profile, not overrides for a request this command makes.
 */
interface ProfileCreateOptions {
  /**
   * `--endpoint <url>`: Phoenix endpoint to store on the new profile.
   * Validated with `isEndpointUrl` before writing.
   *
   * @example "https://app.phoenix.arize.com"
   */
  endpoint?: string;
  /**
   * `--project <name>`: Default project name or ID to store on the new
   * profile.
   *
   * @example "my-app"
   */
  project?: string;
  /**
   * `--api-key <key>`: API key to store on the new profile. Written to the
   * settings file (mode 0600); never echoed back to stdout.
   *
   * @example "phx-abc123"
   */
  apiKey?: string;
  /**
   * `--header <key=value>`: Custom HTTP header to store on the new profile,
   * repeatable. Each value must contain `=`; entries without one are
   * rejected.
   *
   * @example ["X-Custom-Header=value"]
   */
  header?: string[];
  /**
   * `--activate`: Make the new profile the active one immediately after
   * creation, instead of leaving whichever profile was active untouched.
   *
   * @example true // px profile create staging --endpoint https://staging.example.com --activate
   */
  activate?: boolean;
}

async function profileCreateHandler(
  name: string,
  options: ProfileCreateOptions
): Promise<void> {
  if (!validateProfileName(name)) {
    writeError({
      message: `Invalid profile name "${name}". Names must contain only letters, numbers, hyphens, and underscores.`,
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }

  if (options.endpoint && !isEndpointUrl(options.endpoint)) {
    writeError({
      message: `Invalid endpoint "${options.endpoint}". Endpoint ${ENDPOINT_REQUIREMENT}.`,
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }

  // Parse --header key=value pairs
  const headers: Record<string, string> = {};
  for (const h of options.header ?? []) {
    const idx = h.indexOf("=");
    if (idx === -1) {
      writeError({
        message: `Invalid --header "${h}". Expected format: key=value.`,
      });
      process.exit(ExitCode.INVALID_ARGUMENT);
    }
    headers[h.slice(0, idx)] = h.slice(idx + 1);
  }

  const file = loadSettingsStrictOrExit();

  if (file.profiles[name] !== undefined) {
    writeError({
      message: `Profile "${name}" already exists. Delete it first or choose a different name.`,
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }

  const entry: ProfileEntry = {
    ...(options.endpoint ? { endpoint: options.endpoint } : {}),
    ...(options.project ? { project: options.project } : {}),
    ...(options.apiKey ? { apiKey: options.apiKey } : {}),
    ...(Object.keys(headers).length > 0 ? { headers } : {}),
  };

  const newFile: SettingsFile = {
    ...file,
    profiles: { ...file.profiles, [name]: entry },
    activeProfile: options.activate ? name : file.activeProfile,
  };

  saveSettings(newFile);

  const message = options.activate
    ? `Created profile "${name}" and set as active.`
    : `Created profile "${name}".`;
  writeOutput({ message });
}

function createProfileCreateCommand(): Command {
  return new Command("create")
    .description("Create a new profile")
    .argument("<name>", "Profile name (alphanumeric, hyphens, underscores)")
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--project <name>", "Default project name")
    .option(
      "--api-key <key>",
      "Phoenix API key for authentication. Stored in the settings file (mode 0600); never echoed back to stdout."
    )
    .option(
      "--header <key=value>",
      "Custom HTTP header (repeatable)",
      collectString,
      []
    )
    .option(
      "--activate",
      "Make this the active profile after creation (matches `gcloud config configurations create --activate`)"
    )
    .action(profileCreateHandler);
}

// ---------------------------------------------------------------------------
// edit (interactive, strict kubectl semantics)
// ---------------------------------------------------------------------------

/**
 * Resolve the editor command and its baseline arguments from the environment.
 *
 * Splits on whitespace so common multi-token values like `code --wait`,
 * `subl -w`, and `cursor --wait` work. The first token is the binary; any
 * remaining tokens are flags that get prepended to the file path on spawn.
 */
export function resolveEditorCommand(): { command: string; args: string[] } {
  const raw = process.env.PHOENIX_EDITOR ?? process.env.EDITOR ?? "vi";
  const parts = raw
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0);
  const [command, ...args] = parts.length > 0 ? parts : ["vi"];
  return { command, args };
}

/**
 * Run the editor synchronously. Aborts the edit (throws) if the editor
 * cannot be spawned, exits non-zero, or is killed by a signal — matching
 * how `kubectl edit` and `git commit` treat editor exit status: a non-zero
 * exit is the user's signal to discard the edit.
 */
function runEditor(filePath: string): void {
  const { command, args } = resolveEditorCommand();
  const result = spawnSync(command, [...args, filePath], { stdio: "inherit" });
  if (result.error) {
    throw result.error;
  }
  if (result.signal !== null) {
    throw new Error(
      `Editor "${command}" terminated by signal ${result.signal}; discarding edits.`
    );
  }
  if (typeof result.status === "number" && result.status !== 0) {
    throw new Error(
      `Editor "${command}" exited with status ${result.status}; discarding edits.`
    );
  }
}

async function profileEditHandler(name: string): Promise<void> {
  const file = loadSettingsStrictOrExit();

  const existingEntry = file.profiles[name];
  if (existingEntry === undefined) {
    writeError({ message: `Profile "${name}" does not exist.` });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }

  const tmpFile = path.join(
    os.tmpdir(),
    `px-profile-edit-${name}-${Date.now()}.json`
  );
  try {
    fs.writeFileSync(tmpFile, JSON.stringify(existingEntry, null, 2) + "\n", {
      encoding: "utf-8",
      mode: 0o600,
    });

    let validEntry: ProfileEntry | undefined;

    while (validEntry === undefined) {
      try {
        runEditor(tmpFile);
      } catch (err) {
        // Editor failed to spawn, exited non-zero, or was killed by a
        // signal — discard edits and surface a clean error.
        writeError({
          message: err instanceof Error ? err.message : String(err),
        });
        process.exit(ExitCode.FAILURE);
      }

      const raw = fs.readFileSync(tmpFile, "utf-8");
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        writeProgress({ message: "Error: invalid JSON. Re-opening editor..." });
        continue;
      }

      const result = ProfileEntrySchema.safeParse(parsed);
      if (result.success) {
        validEntry = result.data;
      } else {
        const firstIssue = result.error.issues[0];
        const fieldPath = firstIssue.path.join(".");
        const msg = fieldPath
          ? `Validation error at "${fieldPath}": ${firstIssue.message}`
          : `Validation error: ${firstIssue.message}`;
        writeProgress({ message: `${msg}\nRe-opening editor...` });
      }
    }

    const newFile: SettingsFile = {
      ...file,
      profiles: { ...file.profiles, [name]: validEntry },
    };
    saveSettings(newFile);

    writeOutput({ message: `Updated profile "${name}".` });
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      // best-effort cleanup
    }
  }
}

function createProfileEditCommand(): Command {
  return new Command("edit")
    .description("Edit a profile in $EDITOR (interactive, validates on save)")
    .argument("<name>", "Profile name to edit")
    .action(profileEditHandler);
}

// ---------------------------------------------------------------------------
// use
// ---------------------------------------------------------------------------

async function profileUseHandler(name: string): Promise<void> {
  const file = loadSettingsStrictOrExit();

  const entry = file.profiles[name];
  if (entry === undefined) {
    writeError({
      message: `Profile "${name}" does not exist. Run \`px profile list\` to see available profiles.`,
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }

  // Compute the transition message before mutating. `use` writes the
  // *stored* active profile, so the before/after we report should reflect
  // what's persisted in the settings file.
  const previousActive = file.activeProfile;

  if (previousActive === name) {
    writeOutput({ message: `Already active: ${name}` });
    return;
  }

  saveSettings({ ...file, activeProfile: name });

  const message =
    previousActive === null
      ? `Active profile set to ${name}`
      : `Switched active profile: ${previousActive} → ${name}`;
  writeOutput({ message });
}

function createProfileUseCommand(): Command {
  return new Command("use")
    .description("Set the active profile")
    .argument("<name>", "Profile name to activate")
    .action(profileUseHandler);
}

// ---------------------------------------------------------------------------
// delete
// ---------------------------------------------------------------------------

/**
 * Options for `px profile delete`. The `--yes` shape is an exact match for
 * the shared `ConfirmationOptions`, reused here directly; this command
 * registers only `--yes` (no `-y` short alias).
 */
type ProfileDeleteOptions = ConfirmationOptions;

async function profileDeleteHandler(
  name: string,
  options: ProfileDeleteOptions
): Promise<void> {
  const file = loadSettingsStrictOrExit();

  if (file.profiles[name] === undefined) {
    writeError({ message: `Profile "${name}" does not exist.` });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }

  const { confirmOrExit } = await import("../confirm");
  await confirmOrExit({
    message: `Delete profile "${name}"?`,
    yes: options.yes,
  });

  const updatedProfiles = { ...file.profiles };
  delete updatedProfiles[name];

  let newActiveProfile = file.activeProfile;
  let wasActive = false;
  if (file.activeProfile === name) {
    newActiveProfile = null;
    wasActive = true;
  }

  saveSettings({
    ...file,
    profiles: updatedProfiles,
    activeProfile: newActiveProfile,
  });

  const message = wasActive
    ? `Deleted profile "${name}" (was the active profile; no profile is active now). Run \`px profile use <name>\` to set a new active profile.`
    : `Deleted profile "${name}".`;
  writeOutput({ message });
}

function createProfileDeleteCommand(): Command {
  return new Command("delete")
    .description("Delete a profile")
    .argument("<name>", "Profile name to delete")
    .option("--yes", "Skip confirmation prompt")
    .action(profileDeleteHandler);
}

// ---------------------------------------------------------------------------
// Top-level profile command group
// ---------------------------------------------------------------------------

export function createProfileCommand(): Command {
  const command = new Command("profile");
  command.description("Manage named profiles");
  command.addCommand(createProfileListCommand());
  command.addCommand(createProfileShowCommand());
  command.addCommand(createProfileCreateCommand());
  command.addCommand(createProfileEditCommand());
  command.addCommand(createProfileUseCommand());
  command.addCommand(createProfileDeleteCommand());
  return command;
}
