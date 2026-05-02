import {
  ENV_PHOENIX_API_KEY,
  ENV_PHOENIX_CLIENT_HEADERS,
  ENV_PHOENIX_HOST,
  getHeadersFromEnvironment,
  getStrFromEnvironment,
} from "@arizeai/phoenix-config";

import {
  type ProfileEntry,
  getProfileByName,
  getStoredActiveProfile,
  loadSettings,
  ProfileResolutionError,
} from "./settings";

/**
 * Default Phoenix endpoint used when PHOENIX_HOST is not set.
 */
export const DEFAULT_PHOENIX_ENDPOINT = "http://localhost:6006";

/**
 * Configuration for the Phoenix CLI
 */
export interface PhoenixConfig {
  /**
   * The Phoenix API endpoint
   */
  endpoint?: string;

  /**
   * The project name or ID
   */
  project?: string;

  /**
   * API key for authentication
   */
  apiKey?: string;

  /**
   * Custom headers
   */
  headers?: Record<string, string>;
}

/**
 * Returns built-in defaults. These are the lowest-priority tier and should
 * be applied first so that any explicitly configured source can override them.
 */
export function getBuiltInDefaults(): PhoenixConfig {
  return {
    endpoint: DEFAULT_PHOENIX_ENDPOINT,
  };
}

/**
 * Load configuration from environment variables.
 * Only returns values that are explicitly set in the environment — built-in
 * defaults are NOT included, so callers can apply them at the correct tier.
 */
export function loadConfigFromEnvironment(): PhoenixConfig {
  const config: PhoenixConfig = {};

  const endpoint = getStrFromEnvironment(ENV_PHOENIX_HOST);
  if (endpoint) {
    config.endpoint = endpoint;
  }

  const apiKey = getStrFromEnvironment(ENV_PHOENIX_API_KEY);
  if (apiKey) {
    config.apiKey = apiKey;
  }

  const headers = getHeadersFromEnvironment(ENV_PHOENIX_CLIENT_HEADERS);
  if (headers) {
    config.headers = headers;
  }

  // Also check for PHOENIX_PROJECT env var
  const project = getStrFromEnvironment("PHOENIX_PROJECT");
  if (project) {
    config.project = project;
  }

  return config;
}

/**
 * Load configuration from the active named profile.
 *
 * Resolution order for the profile name:
 *   1. `profileName` argument (from --profile CLI flag)
 *   2. `activeProfile` field in the settings file
 *
 * Uses forgiving mode for the settings file itself — a missing or corrupt
 * file returns an empty config so unrelated commands are never blocked.
 *
 * When a profile is explicitly requested (via `profileName`) but does not
 * resolve to an existing entry, throws `ProfileResolutionError` — silently
 * falling back to defaults could point the user at the wrong Phoenix
 * instance.
 *
 * Returns an empty config only when no profile is explicitly requested and
 * no stored `activeProfile` resolves (silent fallthrough to env / defaults).
 */
export function loadConfigFromProfile(profileName?: string): PhoenixConfig {
  const settingsFile = loadSettings();

  if (profileName !== undefined) {
    const active = getProfileByName(settingsFile, profileName);
    if (!active) {
      throw new ProfileResolutionError(
        `Profile "${profileName}" (from --profile) does not exist. Run \`px profile list\` to see available profiles.`
      );
    }
    return profileEntryToConfig(active.entry);
  }

  const active = getStoredActiveProfile(settingsFile);
  if (!active) {
    return {};
  }
  return profileEntryToConfig(active.entry);
}

/**
 * Project a `ProfileEntry` onto the `PhoenixConfig` shape. Skipped fields
 * (e.g. an apiKey set on a different profile) are simply omitted so the
 * downstream merge in `resolveConfig` can layer env vars / defaults on top.
 */
function profileEntryToConfig(entry: ProfileEntry): PhoenixConfig {
  const config: PhoenixConfig = {};
  if (entry.endpoint) config.endpoint = entry.endpoint;
  if (entry.apiKey) config.apiKey = entry.apiKey;
  if (entry.project) config.project = entry.project;
  if (entry.headers) config.headers = entry.headers;
  return config;
}

/**
 * Resolve configuration from supported sources
 * Priority: CLI flags > Environment variables > Active profile > Built-in defaults
 */
export interface ResolveConfigOptions {
  /**
   * CLI-provided config values (typically from Commander). `undefined` values are ignored.
   */
  cliOptions: Partial<PhoenixConfig>;
  /**
   * Explicit profile name (from --profile flag). When provided, overrides
   * the activeProfile stored in the settings file.
   */
  profileName?: string;
}

/**
 * Resolve configuration from supported sources.
 * Priority (highest to lowest):
 *   1. CLI flags
 *   2. Explicitly set environment variables
 *   3. Active profile (from --profile or settings file)
 *   4. Built-in defaults
 */
export function resolveConfig({
  cliOptions,
  profileName,
}: ResolveConfigOptions): PhoenixConfig {
  const builtInDefaults = getBuiltInDefaults();
  const profileConfig = loadConfigFromProfile(profileName);
  const envConfig = loadConfigFromEnvironment();

  // Commander (and other callers) may include keys with `undefined` values.
  // If we spread those over envConfig we would accidentally clobber env vars.
  const definedCliOptions = Object.fromEntries(
    Object.entries(cliOptions).filter(([, value]) => value !== undefined)
  ) as Partial<PhoenixConfig>;

  return {
    ...builtInDefaults,
    ...profileConfig,
    ...envConfig,
    ...definedCliOptions,
  };
}

/**
 * Validate that required configuration is present
 */
export interface ValidateConfigOptions {
  /**
   * Resolved Phoenix CLI configuration.
   */
  config: PhoenixConfig;
  /**
   * Whether a project is required for this command. Defaults to true.
   */
  projectRequired?: boolean;
}

/**
 * Validate that required configuration is present.
 */
export function validateConfig({
  config,
  projectRequired = true,
}: ValidateConfigOptions): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!config.endpoint) {
    errors.push(
      "Phoenix endpoint not configured. Set PHOENIX_HOST environment variable or use --endpoint flag."
    );
  }

  if (projectRequired && !config.project) {
    errors.push(
      "Project not configured. Set PHOENIX_PROJECT environment variable or use --project flag."
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get error message with actionable instructions
 */
export interface GetConfigErrorMessageOptions {
  /**
   * Validation errors to include in the message.
   */
  errors: string[];
}

/**
 * Get error message with actionable instructions.
 */
export function getConfigErrorMessage({
  errors,
}: GetConfigErrorMessageOptions): string {
  const lines = [
    "Configuration Error:",
    "",
    ...errors.map((e) => `  • ${e}`),
    "",
    "Quick Start:",
    "  1. Set your Phoenix endpoint:",
    "     export PHOENIX_HOST=http://localhost:6006",
    "",
    "  2. Set your project name:",
    "     export PHOENIX_PROJECT=my-project",
    "",
    "Or use CLI flags:",
    "  px trace list --endpoint http://localhost:6006 --project my-project",
  ];
  return lines.join("\n");
}
