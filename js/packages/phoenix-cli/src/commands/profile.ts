import { spawnSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { getStrFromEnvironment } from "@arizeai/phoenix-config";
import { Command } from "commander";

import { ENV_PHOENIX_PROFILE } from "../config";
import { ExitCode } from "../exitCodes";
import { writeError, writeOutput, writeProgress } from "../io";
import {
  type ProfileEntry,
  type SettingsFile,
  ProfileEntrySchema,
  SettingsFileError,
  getActiveProfile,
  loadSettings,
  saveSettings,
  validateProfileName,
} from "../settings";
import {
  type OutputFormat,
  type ProfileListEntry,
  formatProfilesOutput,
} from "./formatProfiles";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildProfileListEntries(file: SettingsFile): ProfileListEntry[] {
  const envProfileName = getStrFromEnvironment(ENV_PHOENIX_PROFILE);
  const activeName = getActiveProfile(file, envProfileName)?.name;
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
    active,
  };
}

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function collectStrings(value: string, previous: string[]): string[] {
  return previous.concat([value]);
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

interface ProfileListOptions {
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

interface ProfileShowOptions {
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
    const envProfileName = getStrFromEnvironment(ENV_PHOENIX_PROFILE);
    resolvedName = getActiveProfile(file, envProfileName)?.name;
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

  const envProfileName = getStrFromEnvironment(ENV_PHOENIX_PROFILE);
  const activeName = getActiveProfile(file, envProfileName)?.name;
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

interface ProfileCreateOptions {
  endpoint?: string;
  project?: string;
  apiKey?: string;
  header?: string[];
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

  if (options.endpoint && !isValidUrl(options.endpoint)) {
    writeError({
      message: `Invalid endpoint "${options.endpoint}". Must be an absolute URL (e.g. https://app.phoenix.arize.com).`,
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
      collectStrings,
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

function resolveEditor(): string {
  return process.env.PHOENIX_EDITOR ?? process.env.EDITOR ?? "vi";
}

function runEditor(editor: string, filePath: string): void {
  const result = spawnSync(editor, [filePath], { stdio: "inherit" });
  if (result.error) {
    throw result.error;
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

    const editor = resolveEditor();
    let validEntry: ProfileEntry | undefined;

    while (validEntry === undefined) {
      runEditor(editor, tmpFile);

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

  // Compute the transition message before mutating. We deliberately ignore
  // PHOENIX_PROFILE here — `use` writes the *stored* active profile, so the
  // before/after we report should reflect what's persisted, not what an env
  // var override happens to point at right now.
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

interface ProfileDeleteOptions {
  yes?: boolean;
}

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
