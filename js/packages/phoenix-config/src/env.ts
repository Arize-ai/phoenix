/**
 * Environment variables shared across phoenix packages
 * @module
 */

import { isHeaders } from "./types";

/**
 * Environment variable name for the Phoenix HTTP port.
 * @example
 * process.env[ENV_PHOENIX_PORT] = "6006";
 */
export const ENV_PHOENIX_PORT = "PHOENIX_PORT";

/**
 * Environment variable name for the Phoenix gRPC port (used for OpenTelemetry).
 * @example
 * process.env[ENV_PHOENIX_GRPC_PORT] = "4317";
 */
export const ENV_PHOENIX_GRPC_PORT = "PHOENIX_GRPC_PORT";

/**
 * Environment variable name for the Phoenix host address.
 * @example
 * process.env[ENV_PHOENIX_HOST] = "http://localhost:6006";
 */
export const ENV_PHOENIX_HOST = "PHOENIX_HOST";

/**
 * Environment variable name for custom headers to include in Phoenix client requests.
 * The value should be a JSON-encoded object with string keys and string values.
 * @example
 * process.env[ENV_PHOENIX_CLIENT_HEADERS] = '{"X-Custom-Header": "value"}';
 */
export const ENV_PHOENIX_CLIENT_HEADERS = "PHOENIX_CLIENT_HEADERS";

/**
 * Environment variable name for the Phoenix collector endpoint (used for tracing).
 * @example
 * process.env[ENV_PHOENIX_COLLECTOR_ENDPOINT] = "http://localhost:6006";
 */
export const ENV_PHOENIX_COLLECTOR_ENDPOINT = "PHOENIX_COLLECTOR_ENDPOINT";

/**
 * Environment variable name for the Phoenix API key (used for authentication).
 * @example
 * process.env[ENV_PHOENIX_API_KEY] = "your-api-key";
 */
export const ENV_PHOENIX_API_KEY = "PHOENIX_API_KEY";

/**
 * Retrieves an integer value from an environment variable.
 *
 * @param envKey - The name of the environment variable to read
 * @returns The parsed integer value, or `undefined` if the variable is not set or empty
 *
 * @example
 * const port = getIntFromEnvironment("PHOENIX_PORT");
 * // Returns 6006 if PHOENIX_PORT="6006", undefined otherwise
 */
export function getIntFromEnvironment(envKey: string) {
  const value = process.env[envKey];
  if (!value) {
    return;
  }
  return parseInt(value);
}

/**
 * Retrieves a string value from an environment variable.
 *
 * @param envKey - The name of the environment variable to read
 * @returns The string value, or `undefined` if the variable is not set
 *
 * @example
 * const host = getStrFromEnvironment("PHOENIX_HOST");
 * // Returns "http://localhost:6006" if PHOENIX_HOST="http://localhost:6006"
 */
export function getStrFromEnvironment(envKey: string) {
  return process.env[envKey];
}

/**
 * Retrieves and parses a JSON-encoded headers object from an environment variable.
 *
 * @param envKey - The name of the environment variable to read
 * @returns A parsed headers object (`Record<string, string>`), or `undefined` if:
 *   - The variable is not set or empty
 *   - The value is not valid JSON
 *   - The parsed value is not a valid headers object (all values must be strings)
 *
 * @example
 * // With PHOENIX_CLIENT_HEADERS='{"Authorization": "Bearer token"}'
 * const headers = getHeadersFromEnvironment("PHOENIX_CLIENT_HEADERS");
 * // Returns { Authorization: "Bearer token" }
 */
export function getHeadersFromEnvironment(envKey: string) {
  const value = process.env[envKey];
  if (!value) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(value);
    if (!isHeaders(parsed)) {
      return;
    }
    return parsed;
  } catch {
    return;
  }
}

/**
 * Retrieves all Phoenix configuration values from environment variables.
 *
 * This function reads and parses all recognized Phoenix environment variables,
 * returning them as a typed configuration object.
 *
 * @returns An object containing all Phoenix environment configuration values.
 *   Values are `undefined` if the corresponding environment variable is not set.
 *
 * @example
 * const config = getEnvironmentConfig();
 * // Returns:
 * // {
 * //   PHOENIX_PORT: 6006,
 * //   PHOENIX_GRPC_PORT: 4317,
 * //   PHOENIX_HOST: "http://localhost:6006",
 * //   PHOENIX_CLIENT_HEADERS: { "X-Custom": "header" },
 * //   PHOENIX_COLLECTOR_ENDPOINT: "http://localhost:6006",
 * //   PHOENIX_API_KEY: "api-key"
 * // }
 */
export function getEnvironmentConfig() {
  return {
    [ENV_PHOENIX_PORT]: getIntFromEnvironment(ENV_PHOENIX_PORT),
    [ENV_PHOENIX_GRPC_PORT]: getIntFromEnvironment(ENV_PHOENIX_GRPC_PORT),
    [ENV_PHOENIX_HOST]: getStrFromEnvironment(ENV_PHOENIX_HOST),
    [ENV_PHOENIX_CLIENT_HEADERS]: getHeadersFromEnvironment(
      ENV_PHOENIX_CLIENT_HEADERS
    ),
    [ENV_PHOENIX_COLLECTOR_ENDPOINT]: getStrFromEnvironment(
      ENV_PHOENIX_COLLECTOR_ENDPOINT
    ),
    [ENV_PHOENIX_API_KEY]: getStrFromEnvironment(ENV_PHOENIX_API_KEY),
  };
}

/**
 * Type representing the Phoenix environment configuration object.
 * Inferred from the return type of {@link getEnvironmentConfig}.
 */
export type EnvironmentConfig = ReturnType<typeof getEnvironmentConfig>;
