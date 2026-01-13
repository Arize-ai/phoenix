import {
  ENV_PHOENIX_API_KEY,
  ENV_PHOENIX_CLIENT_HEADERS,
  ENV_PHOENIX_HOST,
  getHeadersFromEnvironment,
  getStrFromEnvironment,
} from "@arizeai/phoenix-config";

/**
 * Configuration for the Phoenix CLI
 */
export interface PhoenixConfig {
  /**
   * The Phoenix API endpoint
   */
  endpoint?: string;

  /**
   * The project name or UUID
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
 * Load configuration from environment variables
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
 * Resolve configuration from supported sources
 * Priority: CLI flags > Environment variables
 */
export interface ResolveConfigOptions {
  /**
   * CLI-provided config values (typically from Commander). `undefined` values are ignored.
   */
  cliOptions: Partial<PhoenixConfig>;
}

/**
 * Resolve configuration from supported sources.
 * Priority: CLI flags > Environment variables.
 */
export function resolveConfig({
  cliOptions,
}: ResolveConfigOptions): PhoenixConfig {
  const envConfig = loadConfigFromEnvironment();

  // Commander (and other callers) may include keys with `undefined` values.
  // If we spread those over envConfig we would accidentally clobber env vars.
  const definedCliOptions = Object.fromEntries(
    Object.entries(cliOptions).filter(([, value]) => value !== undefined)
  ) as Partial<PhoenixConfig>;

  return {
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
}

/**
 * Validate that required configuration is present.
 */
export function validateConfig({ config }: ValidateConfigOptions): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!config.endpoint) {
    errors.push(
      "Phoenix endpoint not configured. Set PHOENIX_HOST environment variable or use --endpoint flag."
    );
  }

  if (!config.project) {
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
    "  px traces --endpoint http://localhost:6006 --project my-project",
  ];
  return lines.join("\n");
}
