import {
  getCredentialsFromEnvironmentWithSource,
  getProjectFromEnvironment,
  getTraceExportEndpointFromEnvironment,
} from "@arizeai/phoenix-config";

/**
 * Resolves the trace-export endpoint and credentials as source-aware groups.
 *
 * The endpoint resolves `PHOENIX_COLLECTOR_ENDPOINT` first, then the
 * OTel-standard `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` and
 * `OTEL_EXPORTER_OTLP_ENDPOINT`, then `PHOENIX_ENDPOINT` — so a configuration
 * that names Phoenix once exports spans there rather than silently to
 * localhost.
 */
export function getEnvConfig() {
  return {
    credentials: getCredentialsFromEnvironmentWithSource(),
    endpoint: getTraceExportEndpointFromEnvironment(),
  };
}

/**
 * A utility function that gets the configured collector URL
 * @returns the URL traces are exported to, as configured in the environment,
 *   or `undefined` if no trace-export variable is set
 */
export function getEnvCollectorURL(): string | undefined {
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
