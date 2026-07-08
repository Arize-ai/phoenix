import {
  DEFAULT_PHOENIX_BASE_URL,
  ENV_PHOENIX_API_KEY,
  ENV_PHOENIX_CLIENT_HEADERS,
  ENV_PHOENIX_HOST,
  ENV_PHOENIX_PROJECT,
  getHeadersFromEnvironment,
  getStrFromEnvironment,
  type Headers,
} from "@arizeai/phoenix-config";

export const DEFAULT_PHOENIX_ENDPOINT = DEFAULT_PHOENIX_BASE_URL;

export interface PhoenixMcpConfig {
  baseUrl: string;
  apiKey?: string;
  headers?: Headers;
  project?: string;
}

export interface ResolveConfigOptions {
  commandLineOptions: {
    baseUrl?: string | boolean;
    apiKey?: string | boolean;
    project?: string | boolean;
  };
}

/**
 * Load Phoenix MCP configuration from environment variables.
 */
export function loadConfigFromEnvironment(): PhoenixMcpConfig {
  const baseUrl = getStrFromEnvironment(ENV_PHOENIX_HOST);
  const apiKey = getStrFromEnvironment(ENV_PHOENIX_API_KEY);
  const headers = getHeadersFromEnvironment(ENV_PHOENIX_CLIENT_HEADERS);
  const project = getStrFromEnvironment(ENV_PHOENIX_PROJECT);

  return {
    baseUrl: baseUrl || DEFAULT_PHOENIX_ENDPOINT,
    apiKey: apiKey || undefined,
    headers: headers || undefined,
    project: project || undefined,
  };
}

/**
 * Extract only the string-valued command-line options, ignoring bare boolean
 * flags that `minimist` produces when a flag is used without a value.
 */
function getStringCommandLineOptions(
  commandLineOptions: ResolveConfigOptions["commandLineOptions"]
): Partial<PhoenixMcpConfig> {
  return {
    ...(typeof commandLineOptions.baseUrl === "string"
      ? { baseUrl: commandLineOptions.baseUrl }
      : {}),
    ...(typeof commandLineOptions.apiKey === "string"
      ? { apiKey: commandLineOptions.apiKey }
      : {}),
    ...(typeof commandLineOptions.project === "string"
      ? { project: commandLineOptions.project }
      : {}),
  };
}

/**
 * Merge environment-derived Phoenix MCP configuration with command-line overrides.
 *
 * Only string command-line values are treated as overrides so that bare flags
 * parsed by `minimist` do not replace valid environment defaults with boolean `true`.
 */
export function resolveConfig({
  commandLineOptions,
}: ResolveConfigOptions): PhoenixMcpConfig {
  const envConfig = loadConfigFromEnvironment();

  return {
    ...envConfig,
    ...getStringCommandLineOptions(commandLineOptions),
  };
}
