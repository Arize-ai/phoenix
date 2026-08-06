import {
  getCollectorEndpointFromEnvironmentWithSource,
  getCredentialsFromEnvironmentWithSource,
  getProjectFromEnvironment,
} from "@arizeai/phoenix-config";

/**
 * Resolves the OTel endpoint and credentials as source-aware groups.
 *
 * The endpoint reads `PHOENIX_COLLECTOR_ENDPOINT` (canonical for trace
 * export), inferring from `PHOENIX_ENDPOINT` when only that is set.
 */
export function getEnvConfig() {
  return {
    credentials: getCredentialsFromEnvironmentWithSource(),
    endpoint: getCollectorEndpointFromEnvironmentWithSource(),
  };
}

/**
 * A utility function that gets the configured collector URL
 * @returns the URL for the phoenix collector endpoint if configured
 */
export function getEnvCollectorURL(): string | undefined {
  // TODO: support OTEL environment variables
  return getEnvConfig().endpoint.value;
}

/**
 * Reads the Phoenix API key from the `PHOENIX_API_KEY` environment variable.
 *
 * @returns The API key if the environment variable is set, otherwise `undefined`.
 */
export function getEnvApiKey(): string | undefined {
  return getEnvConfig().credentials.apiKey;
}

/**
 * Reads the Phoenix project name from the environment.
 *
 * Delegates to `@arizeai/phoenix-config` so the `PHOENIX_PROJECT` (canonical) /
 * `PHOENIX_PROJECT_NAME` (alias) resolution — including precedence and the
 * one-time conflict warning — lives in a single shared implementation.
 *
 * @returns The resolved project name, or `undefined` if neither variable is set.
 */
export function getEnvProjectName(): string | undefined {
  return getProjectFromEnvironment();
}
