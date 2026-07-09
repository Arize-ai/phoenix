import {
  ENV_PHOENIX_API_KEY,
  ENV_PHOENIX_COLLECTOR_ENDPOINT,
  getStrFromEnvironment,
} from "@arizeai/phoenix-config";

/**
 * A utility function that gets the configured collector URL
 * @returns the URL for the phoenix collector endpoint if configured
 */
export function getEnvCollectorURL(): string | undefined {
  // TODO: support OTEL environment variables
  return getStrFromEnvironment(ENV_PHOENIX_COLLECTOR_ENDPOINT);
}

/**
 * Reads the Phoenix API key from the `PHOENIX_API_KEY` environment variable.
 *
 * @returns The API key if the environment variable is set, otherwise `undefined`.
 */
export function getEnvApiKey(): string | undefined {
  return getStrFromEnvironment(ENV_PHOENIX_API_KEY);
}

/**
 * Reads the Phoenix project name from the environment.
 *
 * Resolves `PHOENIX_PROJECT` first, then falls back to the supported
 * `PHOENIX_PROJECT_NAME` alias.
 *
 * @returns The resolved project name, or `undefined` if neither variable is set.
 */
export function getEnvProjectName(): string | undefined {
  return (
    getStrFromEnvironment("PHOENIX_PROJECT") ??
    getStrFromEnvironment("PHOENIX_PROJECT_NAME")
  );
}
