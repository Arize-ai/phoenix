import {
  ENV_PHOENIX_HOST,
  ENV_PHOENIX_PROJECT,
  ENV_PHOENIX_PROJECT_NAME,
  type EnvironmentValueSource,
  getCredentialsFromEnvironmentWithSource,
  getProjectFromEnvironment,
  getStrFromEnvironmentWithSource,
  warnIfUsingFileEndpointWithCredentials,
} from "@arizeai/phoenix-config";

import {
  type OAuthTokens,
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
   * OAuth tokens from the selected profile. Used only when no API key is
   * configured by CLI flag, environment variable, or profile.
   */
  oauthTokens?: OAuthTokens;

  /**
   * Selected profile name. Present when config came from an explicit or active
   * profile and used to persist refreshed OAuth tokens.
   */
  profileName?: string;

  /**
   * Source of the credential that will be used for API requests.
   */
  credentialSource?: "flag" | "env" | "profile-key" | "oauth" | "none";

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
 * Values may come from the process environment or from a discovered
 * `.env.phoenix` file (process values win).
 */
export function loadConfigFromEnvironment(): PhoenixConfig {
  return loadConfigFromEnvironmentWithSources().config;
}

function loadConfigFromEnvironmentWithSources(): {
  config: PhoenixConfig;
  credentialSource?: EnvironmentValueSource;
  endpointSource?: EnvironmentValueSource;
} {
  const config: PhoenixConfig = {};

  const endpoint = getStrFromEnvironmentWithSource(ENV_PHOENIX_HOST);
  if (endpoint.value) {
    config.endpoint = endpoint.value;
  }

  const {
    apiKey,
    headers,
    source: credentialSource,
  } = getCredentialsFromEnvironmentWithSource();
  if (apiKey) {
    config.apiKey = apiKey;
  }
  if (headers) {
    config.headers = headers;
  }

  const project = getProjectFromEnvironment();
  if (project) {
    config.project = project;
  }

  return {
    config,
    credentialSource,
    endpointSource: endpoint.source,
  };
}

function splitEnvironmentConfigTiers(): {
  processEnvConfig: PhoenixConfig;
  envFileConfig: PhoenixConfig;
  endpointSource?: EnvironmentValueSource;
} {
  const {
    config: merged,
    credentialSource,
    endpointSource,
  } = loadConfigFromEnvironmentWithSources();
  const processEnvConfig: PhoenixConfig = {};
  const envFileConfig: PhoenixConfig = {};

  const endpointTier =
    endpointSource?.kind === "process" ? processEnvConfig : envFileConfig;
  if (merged.endpoint) {
    endpointTier.endpoint = merged.endpoint;
  }

  const credentialTier =
    credentialSource?.kind === "process" ? processEnvConfig : envFileConfig;
  if (merged.apiKey) {
    credentialTier.apiKey = merged.apiKey;
  }
  if (merged.headers) {
    credentialTier.headers = merged.headers;
  }

  const projectTier =
    process.env[ENV_PHOENIX_PROJECT] !== undefined ||
    process.env[ENV_PHOENIX_PROJECT_NAME] !== undefined
      ? processEnvConfig
      : envFileConfig;
  if (merged.project) {
    projectTier.project = merged.project;
  }

  return { endpointSource, processEnvConfig, envFileConfig };
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
    return profileEntryToConfig(active.entry, active.name);
  }

  const active = getStoredActiveProfile(settingsFile);
  if (!active) {
    return {};
  }
  return profileEntryToConfig(active.entry, active.name);
}

/**
 * Project a `ProfileEntry` onto the `PhoenixConfig` shape. Skipped fields
 * (e.g. an apiKey set on a different profile) are simply omitted so the
 * downstream merge in `resolveConfig` can layer env vars / defaults on top.
 */
function profileEntryToConfig(
  entry: ProfileEntry,
  profileName: string
): PhoenixConfig {
  const config: PhoenixConfig = {};
  if (entry.endpoint) config.endpoint = entry.endpoint;
  if (entry.apiKey) config.apiKey = entry.apiKey;
  if (entry.oauthTokens) config.oauthTokens = entry.oauthTokens;
  if (entry.project) config.project = entry.project;
  if (entry.headers) config.headers = entry.headers;
  config.profileName = profileName;
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
 *   4. Discovered `.env.phoenix` file values
 *   5. Built-in defaults
 */
export function resolveConfig({
  cliOptions,
  profileName,
}: ResolveConfigOptions): PhoenixConfig {
  const builtInDefaults = getBuiltInDefaults();
  const profileConfig = loadConfigFromProfile(profileName);
  const { endpointSource, processEnvConfig, envFileConfig } =
    splitEnvironmentConfigTiers();

  // Commander (and other callers) may include keys with `undefined` values.
  // If we spread those over envConfig we would accidentally clobber env vars.
  const definedCliOptions = Object.fromEntries(
    Object.entries(cliOptions).filter(([, value]) => value !== undefined)
  ) as Partial<PhoenixConfig>;

  // OAuth tokens are only valid against the endpoint that issued them. When
  // --endpoint or PHOENIX_HOST points the command at a different server, drop
  // the tokens so they are never sent to — or refreshed against — a host that
  // did not issue them.
  const resolvedEndpoint =
    definedCliOptions.endpoint ??
    processEnvConfig.endpoint ??
    profileConfig.endpoint ??
    envFileConfig.endpoint ??
    builtInDefaults.endpoint;
  const boundProfileConfig =
    profileConfig.oauthTokens && profileConfig.endpoint !== resolvedEndpoint
      ? { ...profileConfig, oauthTokens: undefined }
      : profileConfig;

  const credentialSource = getCredentialSource({
    cliOptions: definedCliOptions,
    processEnvConfig,
    envFileConfig,
    profileConfig: boundProfileConfig,
  });

  const oauthTokens =
    credentialSource === "oauth" ? boundProfileConfig.oauthTokens : undefined;

  const config: PhoenixConfig = {
    ...builtInDefaults,
    ...envFileConfig,
    ...profileConfig,
    ...processEnvConfig,
    ...definedCliOptions,
    credentialSource,
    oauthTokens,
  };

  // Profile OAuth outranks `.env.phoenix` API keys. The spread above can leave
  // a file-tier apiKey in place when the profile only has oauthTokens — clear
  // it so clients do not prefer the lower-tier key.
  if (credentialSource === "oauth") {
    config.apiKey = undefined;
  }

  const usesFileEndpoint =
    endpointSource?.kind === "env-file" &&
    definedCliOptions.endpoint === undefined &&
    processEnvConfig.endpoint === undefined &&
    profileConfig.endpoint === undefined;
  const warningCredentialSource =
    definedCliOptions.apiKey !== undefined ||
    definedCliOptions.headers !== undefined
      ? "CLI options"
      : processEnvConfig.apiKey !== undefined ||
          processEnvConfig.headers !== undefined
        ? "the process environment"
        : profileConfig.apiKey !== undefined ||
            profileConfig.headers !== undefined
          ? "the active profile"
          : undefined;
  if (usesFileEndpoint) {
    warnIfUsingFileEndpointWithCredentials({
      credentialSource: warningCredentialSource,
      endpointSource,
      endpointVariable: ENV_PHOENIX_HOST,
    });
  }
  return config;
}

function getCredentialSource({
  cliOptions,
  processEnvConfig,
  envFileConfig,
  profileConfig,
}: {
  cliOptions: Partial<PhoenixConfig>;
  processEnvConfig: PhoenixConfig;
  envFileConfig: PhoenixConfig;
  profileConfig: PhoenixConfig;
}): PhoenixConfig["credentialSource"] {
  if (cliOptions.apiKey) {
    return "flag";
  }
  // Process env outranks the profile; `.env.phoenix` does not.
  if (processEnvConfig.apiKey) {
    return "env";
  }
  if (profileConfig.apiKey) {
    return "profile-key";
  }
  if (profileConfig.oauthTokens) {
    return "oauth";
  }
  if (envFileConfig.apiKey) {
    return "env";
  }
  return "none";
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
