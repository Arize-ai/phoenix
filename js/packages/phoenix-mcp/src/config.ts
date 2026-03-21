const ENV_PHOENIX_HOST = "PHOENIX_HOST";
const ENV_PHOENIX_CLIENT_HEADERS = "PHOENIX_CLIENT_HEADERS";
const ENV_PHOENIX_API_KEY = "PHOENIX_API_KEY";

export const DEFAULT_PHOENIX_ENDPOINT = "http://localhost:6006";

export interface PhoenixMcpConfig {
  baseUrl: string;
  apiKey?: string;
  headers?: Record<string, string>;
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
  const baseUrl = process.env[ENV_PHOENIX_HOST];
  const apiKey = process.env[ENV_PHOENIX_API_KEY];
  const headers = getHeadersFromEnvironment(ENV_PHOENIX_CLIENT_HEADERS);
  const project = process.env.PHOENIX_PROJECT;

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

function getHeadersFromEnvironment(
  envKey: string
): Record<string, string> | undefined {
  const value = process.env[envKey];
  if (!value) {
    return undefined;
  }

  try {
    const parsedValue = JSON.parse(value);
    if (!isHeaders(parsedValue)) {
      return undefined;
    }

    return parsedValue;
  } catch {
    return undefined;
  }
}

function isHeaders(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every((entry) => typeof entry === "string");
}
