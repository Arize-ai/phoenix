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
    baseUrl?: string;
    apiKey?: string;
    project?: string;
  };
}

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

export function resolveConfig({
  cliOptions,
}: ResolveConfigOptions): PhoenixMcpConfig {
  const envConfig = loadConfigFromEnvironment();
  const definedCliOptions = Object.fromEntries(
    Object.entries(cliOptions).filter(([, value]) => value !== undefined)
  ) as Partial<PhoenixMcpConfig>;

  return {
    ...envConfig,
    ...definedCliOptions,
  };
}
