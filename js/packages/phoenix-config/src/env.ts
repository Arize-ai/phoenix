/**
 * Environment variables shared across phoenix packages
 * @module
 */

import { readEnvFileValueWithPath } from "@phoenix-config/env-file";

import { DEFAULT_PHOENIX_PORT } from "./constants";
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
 *
 * On the Phoenix *server* this is the bind host (e.g. `0.0.0.0`), paired with
 * {@link ENV_PHOENIX_PORT}. Some JS packages historically also read it as a
 * client base URL; that use is legacy — prefer {@link ENV_PHOENIX_ENDPOINT}.
 * @example
 * process.env[ENV_PHOENIX_HOST] = "http://localhost:6006";
 */
export const ENV_PHOENIX_HOST = "PHOENIX_HOST";

/**
 * Environment variable name for the Phoenix API endpoint: the base URL that
 * API consumers — the `px` CLI and the API clients — send requests to.
 *
 * For where traces are *exported* to, see
 * {@link ENV_PHOENIX_COLLECTOR_ENDPOINT}; when only one of the two is set,
 * Phoenix tools infer the other from it.
 * @example
 * process.env[ENV_PHOENIX_ENDPOINT] = "http://localhost:6006";
 */
export const ENV_PHOENIX_ENDPOINT = "PHOENIX_ENDPOINT";

/**
 * Environment variable name for the Phoenix API base URL — an accepted alias
 * for {@link ENV_PHOENIX_ENDPOINT}, which takes precedence when both are set.
 * The client docs have historically used this name.
 * @example
 * process.env[ENV_PHOENIX_BASE_URL] = "http://localhost:6006";
 */
export const ENV_PHOENIX_BASE_URL = "PHOENIX_BASE_URL";

/**
 * Environment variable name for custom headers to include in Phoenix client requests.
 * The value should be a JSON-encoded object with string keys and string values.
 * @example
 * process.env[ENV_PHOENIX_CLIENT_HEADERS] = '{"X-Custom-Header": "value"}';
 */
export const ENV_PHOENIX_CLIENT_HEADERS = "PHOENIX_CLIENT_HEADERS";

/**
 * Environment variable name for the Phoenix collector endpoint: the base URL
 * that traces are *exported* to, read by `register()` and the OTLP exporters
 * it configures.
 *
 * For the API-access base URL, see {@link ENV_PHOENIX_ENDPOINT}; when only one
 * of the two is set, Phoenix tools infer the other from it.
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
    return undefined;
  }
  const parsed = parseInt(value);
  if (Number.isNaN(parsed)) {
    return undefined;
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
 * Environment variables that locate the Phoenix server for API access,
 * resolved as one tier group (see {@link resolveEnvironmentTier}). Ordered by
 * precedence.
 */
const BASE_URL_ENV_KEYS = [
  ENV_PHOENIX_ENDPOINT,
  ENV_PHOENIX_BASE_URL,
  ENV_PHOENIX_COLLECTOR_ENDPOINT,
  ENV_PHOENIX_HOST,
] as const;

/**
 * The variables that *deliberately* name the API-access base URL. The rest of
 * {@link BASE_URL_ENV_KEYS} are inferred fallbacks (trace-export / legacy
 * bind variables) and rank below these across tiers.
 */
const CANONICAL_BASE_URL_ENV_KEYS = [
  ENV_PHOENIX_ENDPOINT,
  ENV_PHOENIX_BASE_URL,
] as const;

/**
 * Environment variables that locate the trace collector, resolved as one tier
 * group. Ordered by precedence.
 */
const COLLECTOR_ENDPOINT_ENV_KEYS = [
  ENV_PHOENIX_COLLECTOR_ENDPOINT,
  ENV_PHOENIX_ENDPOINT,
  ENV_PHOENIX_BASE_URL,
] as const;

let hasWarnedBaseUrlConflict = false;

/**
 * Environment variables that configure a Phoenix connection. Test suites
 * clear these before running so a developer's shell (e.g. Claude Code tracing
 * exports `PHOENIX_ENDPOINT`) cannot leak into assertions.
 */
export const PHOENIX_CONNECTION_ENV_KEYS = [
  ...BASE_URL_ENV_KEYS,
  ENV_PHOENIX_API_KEY,
  ENV_PHOENIX_CLIENT_HEADERS,
  ENV_PHOENIX_PROJECT,
  ENV_PHOENIX_PROJECT_NAME,
] as const;

/**
 * Clears the connection env vars a developer's shell may export (e.g. Claude
 * Code tracing sets `PHOENIX_ENDPOINT`) so they cannot leak into test
 * assertions. Call from a test-setup file before any configuration is read.
 *
 * @internal
 */
export function clearPhoenixConnectionEnvForTesting(): void {
  for (const envKey of PHOENIX_CONNECTION_ENV_KEYS) {
    delete process.env[envKey];
  }
}

/**
 * Returns the first key of `envKeys` that has a non-empty value in `values`,
 * together with that value.
 */
function findFirstSetEnvKey(
  envKeys: readonly string[],
  values: Partial<Record<string, string | undefined>>
): { envKey: string; value: string } | undefined {
  for (const envKey of envKeys) {
    const value = values[envKey];
    if (value) {
      return { envKey, value };
    }
  }
  return undefined;
}

/**
 * Returns the first key of `envKeys` that has a value in the nearest
 * `.env.phoenix` file, resolved as a source-tagged value.
 */
function readFirstEnvFileValue(
  envKeys: readonly string[]
): ResolvedBaseUrlValue | undefined {
  for (const envKey of envKeys) {
    const fileValue = readEnvFileValueWithPath(envKey);
    if (fileValue) {
      return {
        envKey,
        source: { filePath: fileValue.filePath, kind: "env-file" },
        value: fileValue.value,
      };
    }
  }
  return undefined;
}

/**
 * Normalizes a base-URL candidate for API access:
 *
 * - a value inferred from `PHOENIX_COLLECTOR_ENDPOINT` may legitimately carry
 *   the OTLP `/v1/traces` path (full-URL exporters need it); the API base URL
 *   must not, so the suffix is stripped
 * - a legacy `PHOENIX_HOST` value may be a bare bind host (e.g. `0.0.0.0`)
 *   rather than a URL; build a reachable http URL from it, the way the Python
 *   client does
 */
function normalizeBaseUrlCandidate({
  envKey,
  value,
  port,
}: {
  envKey: string;
  value: string;
  port?: string;
}): string {
  if (envKey === ENV_PHOENIX_COLLECTOR_ENDPOINT) {
    return value.replace(/\/+v1\/traces\/?$/, "") || value;
  }
  if (envKey === ENV_PHOENIX_HOST && !/^https?:\/\//i.test(value)) {
    const host = value === "0.0.0.0" ? "127.0.0.1" : value;
    return host.includes(":")
      ? `http://${host}`
      : `http://${host}:${port || DEFAULT_PHOENIX_PORT}`;
  }
  return value;
}

/**
 * Resolves the API-access base URL from an arbitrary values record (e.g. an
 * injected copy of `process.env`), applying the {@link BASE_URL_ENV_KEYS}
 * precedence. Unlike {@link getBaseUrlFromEnvironment} this reads only the
 * given record — no `.env.phoenix` discovery and no conflict warning.
 */
export function getBaseUrlFromValues(
  values: Partial<Record<string, string | undefined>>
): string | undefined {
  const resolved = findFirstSetEnvKey(BASE_URL_ENV_KEYS, values);
  if (!resolved) {
    return undefined;
  }
  return normalizeBaseUrlCandidate({
    ...resolved,
    port: values[ENV_PHOENIX_PORT],
  });
}

/**
 * Resolves the base URL for **API access** — what the `px` CLI and the API
 * clients send requests to.
 *
 * Precedence:
 *
 * 1. `PHOENIX_ENDPOINT` — the canonical API-access variable
 * 2. `PHOENIX_BASE_URL` — accepted alias (the name the client docs have
 *    historically used)
 * 3. `PHOENIX_COLLECTOR_ENDPOINT` — inferred: when only the trace-export
 *    variable is set, API access assumes the same server
 * 4. `PHOENIX_HOST` — legacy; on the Phoenix server this variable is the bind
 *    host, so relying on it as a client URL is discouraged
 *
 * The variables resolve as one tier group: the `.env.phoenix` file tier is
 * consulted only when none of them is set in the process environment — except
 * that a process value merely inferred from a trace-export or legacy variable
 * yields to a canonical `PHOENIX_ENDPOINT`/`PHOENIX_BASE_URL` declared in a
 * discovered `.env.phoenix`. Setting `PHOENIX_ENDPOINT` and
 * `PHOENIX_COLLECTOR_ENDPOINT` to different values is legitimate (API access
 * and trace ingest can live at different URLs) and does not warn. A differing
 * `PHOENIX_HOST` that loses the resolution warns once.
 *
 * @returns The resolved base URL, or `undefined` if no variable is set.
 *
 * @example
 * // With PHOENIX_ENDPOINT="http://localhost:6006"
 * const baseUrl = getBaseUrlFromEnvironment();
 * // Returns "http://localhost:6006"
 */
export function getBaseUrlFromEnvironment(): string | undefined {
  return getBaseUrlFromEnvironmentWithSource().value;
}

/**
 * How deliberately the resolved variable names the concept being resolved:
 * `"canonical"` — the variable exists for this concept; `"inferred"` — a
 * sibling concept's variable backfilled it; `"legacy"` — the historical
 * `PHOENIX_HOST` fallback.
 */
export type ResolvedBaseUrlRank = "canonical" | "inferred" | "legacy";

/** A resolved base URL together with the tier and variable that supplied it. */
export interface ResolvedBaseUrlValue extends ResolvedEnvironmentValue {
  /** The environment variable that supplied `value`. */
  envKey?: string;
  /** How deliberately `envKey` names the resolved concept. */
  rank?: ResolvedBaseUrlRank;
}

/**
 * The cross-tier exception to whole-group tier resolution: a process value
 * merely inferred from a sibling variable must not mask the concept's
 * canonical variable declared in a discovered `.env.phoenix`. Returns the
 * file-tier canonical value when that exception applies.
 */
function fileCanonicalOverride({
  source,
  resolvedEnvKey,
  canonicalKeys,
}: {
  source: EnvironmentValueSource | undefined;
  resolvedEnvKey: string;
  canonicalKeys: readonly string[];
}): ResolvedBaseUrlValue | undefined {
  if (source?.kind !== "process" || canonicalKeys.includes(resolvedEnvKey)) {
    return undefined;
  }
  const fileCanonical = readFirstEnvFileValue(canonicalKeys);
  return fileCanonical ? { ...fileCanonical, rank: "canonical" } : undefined;
}

/** Resolves the API-access base URL together with the tier that supplied it. */
export function getBaseUrlFromEnvironmentWithSource(): ResolvedBaseUrlValue {
  const { source, values } =
    resolveEnvironmentTierWithSource(BASE_URL_ENV_KEYS);
  const resolved = findFirstSetEnvKey(BASE_URL_ENV_KEYS, values);
  if (!resolved) {
    return {};
  }

  const override = fileCanonicalOverride({
    source,
    resolvedEnvKey: resolved.envKey,
    canonicalKeys: CANONICAL_BASE_URL_ENV_KEYS,
  });
  if (override) {
    return override;
  }

  const host = values[ENV_PHOENIX_HOST];
  if (
    host &&
    resolved.envKey !== ENV_PHOENIX_HOST &&
    host !== resolved.value &&
    !hasWarnedBaseUrlConflict
  ) {
    hasWarnedBaseUrlConflict = true;
    // eslint-disable-next-line no-console
    console.warn(
      `Both ${resolved.envKey} ("${resolved.value}") and ${ENV_PHOENIX_HOST} ("${host}") ` +
        `are set to different values. Using ${resolved.envKey} ("${resolved.value}"). ` +
        `${ENV_PHOENIX_HOST} is the Phoenix server's bind setting and is only read as a legacy fallback.`
    );
  }

  return {
    source,
    envKey: resolved.envKey,
    rank: (CANONICAL_BASE_URL_ENV_KEYS as readonly string[]).includes(
      resolved.envKey
    )
      ? "canonical"
      : resolved.envKey === ENV_PHOENIX_HOST
        ? "legacy"
        : "inferred",
    value: normalizeBaseUrlCandidate({
      ...resolved,
      port: readEnvValue(ENV_PHOENIX_PORT),
    }),
  };
}

/**
 * Resolves the base URL that **traces are exported to** — what `register()`
 * and the OTLP exporters it configures send spans to.
 *
 * Precedence:
 *
 * 1. `PHOENIX_COLLECTOR_ENDPOINT` — the canonical trace-export variable
 * 2. `PHOENIX_ENDPOINT` (then its alias `PHOENIX_BASE_URL`) — inferred: when
 *    only an API-access variable is set, trace export assumes the same server
 *
 * The variables resolve as one tier group (file tier only when none is set in
 * the process environment) — except that a process value merely inferred from
 * an API-access variable yields to a canonical `PHOENIX_COLLECTOR_ENDPOINT`
 * declared in a discovered `.env.phoenix`. Setting trace-export and API-access
 * variables to different values is legitimate and does not warn.
 *
 * @returns The resolved collector base URL, or `undefined` if neither
 *   variable is set.
 */
export function getCollectorEndpointFromEnvironment(): string | undefined {
  return getCollectorEndpointFromEnvironmentWithSource().value;
}

/** Resolves the collector base URL together with the tier that supplied it. */
export function getCollectorEndpointFromEnvironmentWithSource(): ResolvedBaseUrlValue {
  const { source, values } = resolveEnvironmentTierWithSource(
    COLLECTOR_ENDPOINT_ENV_KEYS
  );
  const resolved = findFirstSetEnvKey(COLLECTOR_ENDPOINT_ENV_KEYS, values);
  if (!resolved) {
    return {};
  }
  const override = fileCanonicalOverride({
    source,
    resolvedEnvKey: resolved.envKey,
    canonicalKeys: [ENV_PHOENIX_COLLECTOR_ENDPOINT],
  });
  if (override) {
    return override;
  }
  return {
    source,
    ...resolved,
    rank:
      resolved.envKey === ENV_PHOENIX_COLLECTOR_ENDPOINT
        ? "canonical"
        : "inferred",
  };
}

/**
 * Resets the one-time base-URL conflict warning latch.
 *
 * Intended for use in tests that need to exercise the warning path more than
 * once within the same module instance.
 *
 * @internal
 */
export function resetBaseUrlConflictWarningForTesting(): void {
  hasWarnedBaseUrlConflict = false;
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
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
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
