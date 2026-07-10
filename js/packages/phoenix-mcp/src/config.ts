import {
  DEFAULT_PHOENIX_BASE_URL,
  ENV_PHOENIX_HOST,
  type EnvironmentValueSource,
  getCredentialsFromEnvironmentWithSource,
  getProjectFromEnvironment,
  getStrFromEnvironmentWithSource,
  type Headers,
  warnIfUsingFileEndpointWithCredentials,
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

/** Load Phoenix MCP configuration from environment variables. */
export function loadConfigFromEnvironment(): PhoenixMcpConfig {
  return loadConfigFromEnvironmentWithSources().config;
}

function loadConfigFromEnvironmentWithSources(): {
  config: PhoenixMcpConfig;
  credentialSource?: EnvironmentValueSource;
  endpointSource?: EnvironmentValueSource;
} {
  const baseUrl = getStrFromEnvironmentWithSource(ENV_PHOENIX_HOST);
  const {
    apiKey,
    headers,
    source: credentialSource,
  } = getCredentialsFromEnvironmentWithSource();
  const project = getProjectFromEnvironment();

  return {
    config: {
      baseUrl: baseUrl.value || DEFAULT_PHOENIX_ENDPOINT,
      apiKey: apiKey || undefined,
      headers: headers || undefined,
      project: project || undefined,
    },
    credentialSource,
    endpointSource: baseUrl.source,
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
  const {
    config: envConfig,
    credentialSource,
    endpointSource,
  } = loadConfigFromEnvironmentWithSources();
  const commandLineConfig = getStringCommandLineOptions(commandLineOptions);
  const usesFileEndpoint =
    endpointSource?.kind === "env-file" &&
    commandLineConfig.baseUrl === undefined;
  const resolvedCredentialSource =
    commandLineConfig.apiKey !== undefined
      ? "command-line options"
      : credentialSource?.kind === "process"
        ? "the process environment"
        : undefined;
  if (usesFileEndpoint) {
    warnIfUsingFileEndpointWithCredentials({
      credentialSource: resolvedCredentialSource,
      endpointSource,
      endpointVariable: ENV_PHOENIX_HOST,
    });
  }

  return {
    ...envConfig,
    ...commandLineConfig,
  };
}
