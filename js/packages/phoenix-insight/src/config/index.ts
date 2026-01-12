/**
 * Config singleton module for Phoenix Insight CLI
 *
 * Provides centralized configuration management with priority-based merging:
 * 1. Config file (lowest priority)
 * 2. Environment variables
 * 3. CLI arguments (highest priority)
 */

import { configSchema, type Config, getDefaultConfig } from "./schema.js";
import {
  getConfigPath,
  loadConfigFile,
  validateConfig,
  createDefaultConfig,
  setCliConfigPath,
} from "./loader.js";

// Re-export Config type for convenience
export type { Config } from "./schema.js";

/**
 * Module-level storage for the initialized config singleton
 */
let configInstance: Config | null = null;

/**
 * CLI arguments that can override config values
 */
export interface CliArgs {
  /** Custom config file path */
  config?: string;
  /** Phoenix server base URL */
  baseUrl?: string;
  /** Phoenix API key */
  apiKey?: string;
  /** Maximum spans to fetch per project */
  limit?: number;
  /** Enable streaming responses */
  stream?: boolean;
  /** Execution mode: sandbox or local */
  local?: boolean;
  /** Force refresh of snapshot data */
  refresh?: boolean;
  /** Enable tracing */
  trace?: boolean;
}

/**
 * Environment variable mappings to config keys
 */
const ENV_VAR_MAPPINGS: Record<string, keyof Config> = {
  PHOENIX_BASE_URL: "baseUrl",
  PHOENIX_API_KEY: "apiKey",
  PHOENIX_INSIGHT_LIMIT: "limit",
  PHOENIX_INSIGHT_STREAM: "stream",
  PHOENIX_INSIGHT_MODE: "mode",
  PHOENIX_INSIGHT_REFRESH: "refresh",
  PHOENIX_INSIGHT_TRACE: "trace",
};

/**
 * Parse environment variable value to appropriate type
 */
function parseEnvValue(
  key: keyof Config,
  value: string
): string | number | boolean | undefined {
  switch (key) {
    case "baseUrl":
    case "apiKey":
      return value;
    case "limit":
      const num = parseInt(value, 10);
      return isNaN(num) ? undefined : num;
    case "stream":
    case "refresh":
    case "trace":
      return value.toLowerCase() === "true" || value === "1";
    case "mode":
      if (value === "sandbox" || value === "local") {
        return value;
      }
      return undefined;
    default:
      return value;
  }
}

/**
 * Get config values from environment variables
 */
function getEnvConfig(): Partial<Config> {
  const envConfig: Partial<Config> = {};

  for (const [envVar, configKey] of Object.entries(ENV_VAR_MAPPINGS)) {
    const value = process.env[envVar];
    if (value !== undefined) {
      const parsed = parseEnvValue(configKey, value);
      if (parsed !== undefined) {
        (envConfig as any)[configKey] = parsed;
      }
    }
  }

  return envConfig;
}

/**
 * Convert CLI args to config format
 */
function cliArgsToConfig(cliArgs: CliArgs): Partial<Config> {
  const config: Partial<Config> = {};

  if (cliArgs.baseUrl !== undefined) {
    config.baseUrl = cliArgs.baseUrl;
  }
  if (cliArgs.apiKey !== undefined) {
    config.apiKey = cliArgs.apiKey;
  }
  if (cliArgs.limit !== undefined) {
    config.limit = cliArgs.limit;
  }
  if (cliArgs.stream !== undefined) {
    config.stream = cliArgs.stream;
  }
  if (cliArgs.local !== undefined) {
    // CLI uses --local flag, config uses mode
    config.mode = cliArgs.local ? "local" : "sandbox";
  }
  if (cliArgs.refresh !== undefined) {
    config.refresh = cliArgs.refresh;
  }
  if (cliArgs.trace !== undefined) {
    config.trace = cliArgs.trace;
  }

  return config;
}

/**
 * Initialize the configuration singleton
 *
 * Merges configuration from multiple sources with the following priority:
 * 1. Config file (lowest priority)
 * 2. Environment variables
 * 3. CLI arguments (highest priority)
 *
 * @param cliArgs - CLI arguments from Commander
 * @returns The initialized configuration
 */
export async function initializeConfig(cliArgs: CliArgs = {}): Promise<Config> {
  // Set CLI config path if provided (for getConfigPath to use)
  if (cliArgs.config) {
    setCliConfigPath(cliArgs.config);
  }

  // Get config file path
  const { path: configPath, isDefault } = getConfigPath();

  // Try to create default config if it doesn't exist (only for default path)
  if (isDefault) {
    await createDefaultConfig(configPath, isDefault);
  }

  // Load config file
  const fileConfig = await loadConfigFile(configPath);

  // Validate file config (returns defaults if null/invalid)
  const validatedFileConfig = validateConfig(fileConfig);

  // Get environment config
  const envConfig = getEnvConfig();

  // Get CLI config
  const cliConfig = cliArgsToConfig(cliArgs);

  // Merge configs: file < env < cli
  const mergedConfig = {
    ...validatedFileConfig,
    ...envConfig,
    ...cliConfig,
  };

  // Final validation with Zod
  const result = configSchema.safeParse(mergedConfig);

  if (result.success) {
    configInstance = result.data;
  } else {
    // Log validation issues as warnings
    result.error.issues.forEach((issue) => {
      console.warn(
        `Warning: Config validation error at '${issue.path.join(".")}': ${issue.message}`
      );
    });
    // Fall back to defaults
    configInstance = getDefaultConfig();
  }

  return configInstance;
}

/**
 * Get the initialized configuration
 *
 * @throws Error if config has not been initialized via initializeConfig()
 * @returns The configuration object
 */
export function getConfig(): Config {
  if (configInstance === null) {
    throw new Error(
      "Config not initialized. Call initializeConfig() first before using getConfig()."
    );
  }
  return configInstance;
}

/**
 * Reset the config singleton (useful for testing)
 */
export function resetConfig(): void {
  configInstance = null;
  setCliConfigPath(undefined);
}
