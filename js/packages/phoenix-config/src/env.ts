/**
 * Environment variables shared across phoenix packages
 * @module
 */

import { readEnvFileValueWithPath } from "@phoenix-config/env-file";

import type { Headers } from "./types";
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
 * Environment variable name for the Phoenix log level.
 * Controls the verbosity of Phoenix client logging.
 * Valid values: "debug" | "info" | "warn" | "error" | "silent"
 * @example
 * process.env[ENV_PHOENIX_LOG_LEVEL] = "debug";
 */
export const ENV_PHOENIX_LOG_LEVEL = "PHOENIX_LOG_LEVEL";

/**
 * Environment variable name for the default Phoenix project (canonical name).
 * When set, project-scoped operations use this project unless overridden.
 * @example
 * process.env[ENV_PHOENIX_PROJECT] = "my-project";
 */
export const ENV_PHOENIX_PROJECT = "PHOENIX_PROJECT";

/**
 * Environment variable name for the default Phoenix project (supported alias).
 * Accepted so the Python SDKs' `PHOENIX_PROJECT_NAME` keeps working. When set,
 * project-scoped operations use this project unless overridden. Prefer
 * {@link ENV_PHOENIX_PROJECT}, which takes precedence when both are set.
 * @example
 * process.env[ENV_PHOENIX_PROJECT_NAME] = "my-project";
 */
export const ENV_PHOENIX_PROJECT_NAME = "PHOENIX_PROJECT_NAME";

/**
 * Environment variables that carry credentials, resolved as one tier group
 * (see {@link resolveEnvironmentTier}).
 */
export const PHOENIX_CREDENTIAL_ENV_KEYS = [
  ENV_PHOENIX_API_KEY,
  ENV_PHOENIX_CLIENT_HEADERS,
] as const;

/** The source tier that supplied a resolved environment value. */
export type EnvironmentValueSource =
  | { kind: "process" }
  | { filePath: string; kind: "env-file" };

export interface ResolvedEnvironmentValue {
  source?: EnvironmentValueSource;
  value?: string;
}

export interface ResolvedEnvironmentTier {
  source?: EnvironmentValueSource;
  values: Partial<Record<string, string>>;
}

function getProcessEnvironment(): Partial<Record<string, string | undefined>> {
  return typeof process === "undefined" ? {} : process.env;
}

/**
 * Reads an environment variable from the process environment, falling back to
 * the nearest `.env.phoenix` file for `PHOENIX_`-prefixed keys (process wins).
 */
export function getStrFromEnvironmentWithSource(
  envKey: string
): ResolvedEnvironmentValue {
  const processValue = getProcessEnvironment()[envKey];
  if (processValue !== undefined) {
    return { source: { kind: "process" }, value: processValue };
  }
  const fileValue = readEnvFileValueWithPath(envKey);
  if (fileValue) {
    return {
      source: { filePath: fileValue.filePath, kind: "env-file" },
      value: fileValue.value,
    };
  }
  return {};
}

function readEnvValue(envKey: string): string | undefined {
  return getStrFromEnvironmentWithSource(envKey).value;
}

/**
 * Resolves a group of related environment variables as one two-tier unit:
 * the `.env.phoenix` file tier is consulted only when none of the group's
 * keys are set in the process environment.
 *
 * @param envKeys - the environment variable names forming the group
 * @returns The resolved values, keyed by environment variable name.
 */
export function resolveEnvironmentTier(
  envKeys: readonly string[]
): Partial<Record<string, string>> {
  return resolveEnvironmentTierWithSource(envKeys).values;
}

/** Resolves a setting group together with the tier that supplied it. */
export function resolveEnvironmentTierWithSource(
  envKeys: readonly string[]
): ResolvedEnvironmentTier {
  const processValues: Partial<Record<string, string>> = {};
  const processEnvironment = getProcessEnvironment();
  for (const envKey of envKeys) {
    const value = processEnvironment[envKey];
    if (value !== undefined) {
      processValues[envKey] = value;
    }
  }
  if (Object.keys(processValues).length > 0) {
    return { source: { kind: "process" }, values: processValues };
  }
  const fileValues: Partial<Record<string, string>> = {};
  let filePath: string | undefined;
  for (const envKey of envKeys) {
    const result = readEnvFileValueWithPath(envKey);
    if (result) {
      fileValues[envKey] = result.value;
      filePath = result.filePath;
    }
  }
  return {
    source: filePath ? { filePath, kind: "env-file" } : undefined,
    values: fileValues,
  };
}

const warnedCrossTierEndpoints = new Set<string>();

/**
 * Warns once when higher-priority credentials will be sent to an endpoint
 * selected by a discovered `.env.phoenix` file.
 */
export function warnIfUsingFileEndpointWithCredentials({
  credentialSource,
  endpointSource,
  endpointVariable,
}: {
  credentialSource?: string;
  endpointSource?: EnvironmentValueSource;
  endpointVariable: string;
}): void {
  if (!credentialSource || endpointSource?.kind !== "env-file") {
    return;
  }
  const warningKey = `${endpointSource.filePath}\0${endpointVariable}`;
  if (warnedCrossTierEndpoints.has(warningKey)) {
    return;
  }
  warnedCrossTierEndpoints.add(warningKey);
  // eslint-disable-next-line no-console
  console.warn(
    `Credentials from ${credentialSource} will be sent to ${endpointVariable} ` +
      `set by ${endpointSource.filePath}.`
  );
}

/** @internal Resets the one-time cross-tier warning latch for tests. */
export function resetCrossTierEndpointWarningsForTesting(): void {
  warnedCrossTierEndpoints.clear();
}

/**
 * Retrieves an integer value from an environment variable, falling back to the
 * nearest `.env.phoenix` file when the variable is not set in the process
 * environment.
 *
 * @param envKey - The name of the environment variable to read
 * @returns The parsed integer value, or `undefined` if the variable is not set, empty, or not a valid integer
 *
 * @example
 * const port = getIntFromEnvironment("PHOENIX_PORT");
 * // Returns 6006 if PHOENIX_PORT="6006", undefined otherwise
 */
export function getIntFromEnvironment(envKey: string) {
  const value = readEnvValue(envKey);
  if (!value) {
    return;
  }
  const parsed = parseInt(value);
  if (Number.isNaN(parsed)) {
    return;
  }
  return parsed;
}

/**
 * Retrieves a string value from an environment variable, falling back to the
 * nearest `.env.phoenix` file when the variable is not set in the process
 * environment.
 *
 * @param envKey - The name of the environment variable to read
 * @returns The string value, or `undefined` if the variable is not set
 *
 * @example
 * const host = getStrFromEnvironment("PHOENIX_HOST");
 * // Returns "http://localhost:6006" if PHOENIX_HOST="http://localhost:6006"
 */
export function getStrFromEnvironment(envKey: string) {
  return readEnvValue(envKey);
}

/**
 * Tracks whether the one-time conflict warning has already been emitted so that
 * repeated calls to {@link getProjectFromEnvironment} do not spam the console.
 */
let hasWarnedProjectConflict = false;

/**
 * Resolves the default Phoenix project name from the environment.
 *
 * Reads both {@link ENV_PHOENIX_PROJECT} (canonical) and
 * {@link ENV_PHOENIX_PROJECT_NAME} (supported alias). Precedence is:
 *
 * 1. `PHOENIX_PROJECT`
 * 2. `PHOENIX_PROJECT_NAME`
 *
 * Explicit arguments/flags supplied by callers still take precedence over both;
 * this function only covers the environment fallback. When both variables are
 * set to *different* values, the canonical value wins and a one-time warning is
 * emitted naming both values.
 *
 * @returns The resolved project name, or `undefined` if neither variable is set.
 *
 * @example
 * // With PHOENIX_PROJECT="checkout"
 * const project = getProjectFromEnvironment();
 * // Returns "checkout"
 */
export function getProjectFromEnvironment(): string | undefined {
  const values = resolveEnvironmentTier([
    ENV_PHOENIX_PROJECT,
    ENV_PHOENIX_PROJECT_NAME,
  ]);
  const canonical = values[ENV_PHOENIX_PROJECT];
  const alias = values[ENV_PHOENIX_PROJECT_NAME];

  if (canonical && alias && canonical !== alias && !hasWarnedProjectConflict) {
    hasWarnedProjectConflict = true;
    // eslint-disable-next-line no-console
    console.warn(
      `Both ${ENV_PHOENIX_PROJECT} ("${canonical}") and ${ENV_PHOENIX_PROJECT_NAME} ("${alias}") ` +
        `are set to different values. Using ${ENV_PHOENIX_PROJECT} ("${canonical}"). ` +
        `${ENV_PHOENIX_PROJECT_NAME} is a supported alias for ${ENV_PHOENIX_PROJECT}.`
    );
  }

  return canonical || alias || undefined;
}

/**
 * Resets the one-time project-conflict warning latch.
 *
 * Intended for use in tests that need to exercise the warning path more than
 * once within the same module instance.
 *
 * @internal
 */
export function resetProjectConflictWarningForTesting(): void {
  hasWarnedProjectConflict = false;
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
  return parseHeaders(readEnvValue(envKey));
}

/**
 * Parses a JSON-encoded headers value into a headers object.
 *
 * @param value - the raw (JSON) headers value, e.g. from an environment
 *   variable
 * @returns The parsed headers object, or `undefined` if the value is unset,
 *   empty, not valid JSON, or not a valid headers object.
 */
export function parseHeaders(value: string | undefined): Headers | undefined {
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
 * Retrieves the Phoenix credentials (API key and client headers) from the
 * environment, resolved as one tier group.
 *
 * @returns The resolved API key and parsed client headers, each `undefined`
 *   when not configured.
 */
export function getCredentialsFromEnvironment(): {
  apiKey?: string;
  headers?: Headers;
} {
  const { apiKey, headers } = getCredentialsFromEnvironmentWithSource();
  return { apiKey, headers };
}

/** Resolves credentials together with the tier that supplied them. */
export function getCredentialsFromEnvironmentWithSource(): {
  apiKey?: string;
  headers?: Headers;
  source?: EnvironmentValueSource;
} {
  const { source, values } = resolveEnvironmentTierWithSource(
    PHOENIX_CREDENTIAL_ENV_KEYS
  );
  return {
    apiKey: values[ENV_PHOENIX_API_KEY] || undefined,
    headers: parseHeaders(values[ENV_PHOENIX_CLIENT_HEADERS]),
    source,
  };
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
 * //   PHOENIX_API_KEY: "api-key",
 * //   PHOENIX_PROJECT: "my-project"
 * // }
 */
export function getEnvironmentConfig() {
  const credentials = getCredentialsFromEnvironment();
  return {
    [ENV_PHOENIX_PORT]: getIntFromEnvironment(ENV_PHOENIX_PORT),
    [ENV_PHOENIX_GRPC_PORT]: getIntFromEnvironment(ENV_PHOENIX_GRPC_PORT),
    [ENV_PHOENIX_HOST]: getStrFromEnvironment(ENV_PHOENIX_HOST),
    [ENV_PHOENIX_CLIENT_HEADERS]: credentials.headers,
    [ENV_PHOENIX_COLLECTOR_ENDPOINT]: getStrFromEnvironment(
      ENV_PHOENIX_COLLECTOR_ENDPOINT
    ),
    [ENV_PHOENIX_API_KEY]: credentials.apiKey,
    [ENV_PHOENIX_LOG_LEVEL]: getStrFromEnvironment(ENV_PHOENIX_LOG_LEVEL),
    // Resolves PHOENIX_PROJECT (canonical) then PHOENIX_PROJECT_NAME (alias).
    [ENV_PHOENIX_PROJECT]: getProjectFromEnvironment(),
  };
}

/**
 * Type representing the Phoenix environment configuration object.
 * Inferred from the return type of {@link getEnvironmentConfig}.
 */
export type EnvironmentConfig = ReturnType<typeof getEnvironmentConfig>;
