import {
  ENV_PHOENIX_API_KEY,
  ENV_PHOENIX_COLLECTOR_ENDPOINT,
  getProjectFromEnvironment,
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
 * Delegates to `@arizeai/phoenix-config` so the `PHOENIX_PROJECT_NAME`
 * (canonical) / `PHOENIX_PROJECT` (alias) resolution — including precedence and
 * the one-time conflict warning — lives in a single shared implementation.
 *
 * @returns The resolved project name, or `undefined` if neither variable is set.
 */
export function getEnvProjectName(): string | undefined {
  return getProjectFromEnvironment();
}
