import {
  DEFAULT_PHOENIX_BASE_URL,
  ENV_PHOENIX_API_KEY,
  ENV_PHOENIX_CLIENT_HEADERS,
  ENV_PHOENIX_HOST,
  getHeadersFromEnvironment,
  getStrFromEnvironment,
  type Headers,
} from "@arizeai/phoenix-config";

const ENV_PHOENIX_PROJECT = "PHOENIX_PROJECT";

export const DEFAULT_PHOENIX_ENDPOINT = DEFAULT_PHOENIX_BASE_URL;

export interface PhoenixMcpConfig {
  baseUrl: string;
  apiKey?: string;
  headers?: Headers;
  project?: string;
}

export interface ResolveConfigOptions {
  cliOptions: {
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

function getStringCliOptions(
  cliOptions: ResolveConfigOptions["cliOptions"]
): Partial<PhoenixMcpConfig> {
  return {
    ...(typeof cliOptions.baseUrl === "string"
      ? { baseUrl: cliOptions.baseUrl }
      : {}),
    ...(typeof cliOptions.apiKey === "string"
      ? { apiKey: cliOptions.apiKey }
      : {}),
    ...(typeof cliOptions.project === "string"
      ? { project: cliOptions.project }
      : {}),
  };
}

/**
 * Merge environment-derived Phoenix MCP configuration with CLI overrides.
 *
 * Only string CLI values are treated as overrides so that bare flags parsed by
 * `minimist` do not replace valid environment defaults with boolean `true`.
 */
export function resolveConfig({
  cliOptions,
}: ResolveConfigOptions): PhoenixMcpConfig {
  const envConfig = loadConfigFromEnvironment();

  return {
    ...envConfig,
    ...getStringCliOptions(cliOptions),
  };
}
