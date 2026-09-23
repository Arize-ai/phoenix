import { clearPhoenixConnectionEnvForTesting } from "@arizeai/phoenix-config";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createClient } from "../src";

/**
 * # Endpoint resolution conformance table
 *
 * The same rows asserted in `@arizeai/phoenix-config` (which owns the table's
 * documentation) and `@arizeai/phoenix-otel`, here pinning the column this
 * package decides: the base URL API calls are sent to, including the localhost
 * default that applies when no variable resolves. A row that disagrees across
 * packages or languages is the drift this table exists to catch.
 */
export interface EndpointConformanceRow {
  /** Human-readable environment description; also the test name. */
  name: string;
  /** Process environment variables set for the row. */
  env: Record<string, string>;
  /** Resolved API base URL, or `undefined` when no variable supplies one. */
  apiBaseUrl?: string;
  /** Raw value trace export resolved, before the OTLP path is applied. */
  traceExportEndpoint?: string;
  /** How the resolved trace-export value is treated. */
  traceExportShape?: "base-or-full" | "fully-qualified";
  /** Final OTLP export URL, including the localhost default. */
  traceExportUrl: string;
}

const DEFAULT_TRACE_EXPORT_URL = "http://localhost:6006/v1/traces";

export const ENDPOINT_RESOLUTION_CONFORMANCE_TABLE: EndpointConformanceRow[] = [
  {
    name: "nothing set",
    env: {},
    apiBaseUrl: undefined,
    traceExportEndpoint: undefined,
    traceExportUrl: DEFAULT_TRACE_EXPORT_URL,
  },
  {
    name: "PHOENIX_ENDPOINT only",
    env: { PHOENIX_ENDPOINT: "http://api" },
    apiBaseUrl: "http://api",
    traceExportEndpoint: "http://api",
    traceExportShape: "base-or-full",
    traceExportUrl: "http://api/v1/traces",
  },
  {
    name: "PHOENIX_COLLECTOR_ENDPOINT only",
    env: { PHOENIX_COLLECTOR_ENDPOINT: "http://col" },
    apiBaseUrl: "http://col",
    traceExportEndpoint: "http://col",
    traceExportShape: "base-or-full",
    traceExportUrl: "http://col/v1/traces",
  },
  {
    name: "PHOENIX_ENDPOINT and PHOENIX_COLLECTOR_ENDPOINT",
    env: {
      PHOENIX_ENDPOINT: "http://api",
      PHOENIX_COLLECTOR_ENDPOINT: "http://col",
    },
    apiBaseUrl: "http://api",
    traceExportEndpoint: "http://col",
    traceExportShape: "base-or-full",
    traceExportUrl: "http://col/v1/traces",
  },
  {
    name: "PHOENIX_BASE_URL only",
    env: { PHOENIX_BASE_URL: "http://base" },
    apiBaseUrl: "http://base",
    traceExportEndpoint: undefined,
    traceExportUrl: DEFAULT_TRACE_EXPORT_URL,
  },
  {
    name: "PHOENIX_BASE_URL and PHOENIX_COLLECTOR_ENDPOINT",
    env: {
      PHOENIX_BASE_URL: "http://base",
      PHOENIX_COLLECTOR_ENDPOINT: "http://col",
    },
    apiBaseUrl: "http://col",
    traceExportEndpoint: "http://col",
    traceExportShape: "base-or-full",
    traceExportUrl: "http://col/v1/traces",
  },
  {
    name: "PHOENIX_BASE_URL and PHOENIX_ENDPOINT",
    env: { PHOENIX_BASE_URL: "http://base", PHOENIX_ENDPOINT: "http://api" },
    apiBaseUrl: "http://api",
    traceExportEndpoint: "http://api",
    traceExportShape: "base-or-full",
    traceExportUrl: "http://api/v1/traces",
  },
  {
    name: "PHOENIX_COLLECTOR_ENDPOINT carrying the OTLP path",
    env: { PHOENIX_COLLECTOR_ENDPOINT: "http://col/v1/traces" },
    apiBaseUrl: "http://col",
    traceExportEndpoint: "http://col/v1/traces",
    traceExportShape: "base-or-full",
    traceExportUrl: "http://col/v1/traces",
  },
  {
    name: "OTEL_EXPORTER_OTLP_ENDPOINT only",
    env: { OTEL_EXPORTER_OTLP_ENDPOINT: "http://otlp" },
    apiBaseUrl: "http://otlp",
    traceExportEndpoint: "http://otlp",
    traceExportShape: "base-or-full",
    traceExportUrl: "http://otlp/v1/traces",
  },
  {
    name: "PHOENIX_COLLECTOR_ENDPOINT outranks OTEL_EXPORTER_OTLP_ENDPOINT",
    env: {
      PHOENIX_COLLECTOR_ENDPOINT: "http://col",
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://otlp",
    },
    apiBaseUrl: "http://col",
    traceExportEndpoint: "http://col",
    traceExportShape: "base-or-full",
    traceExportUrl: "http://col/v1/traces",
  },
  {
    name: "PHOENIX_ENDPOINT and OTEL_EXPORTER_OTLP_ENDPOINT split the concerns",
    env: {
      PHOENIX_ENDPOINT: "http://api",
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://otlp",
    },
    apiBaseUrl: "http://api",
    traceExportEndpoint: "http://otlp",
    traceExportShape: "base-or-full",
    traceExportUrl: "http://otlp/v1/traces",
  },
  {
    name: "OTEL_EXPORTER_OTLP_ENDPOINT outranks PHOENIX_BASE_URL",
    env: {
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://otlp",
      PHOENIX_BASE_URL: "http://base",
    },
    apiBaseUrl: "http://otlp",
    traceExportEndpoint: "http://otlp",
    traceExportShape: "base-or-full",
    traceExportUrl: "http://otlp/v1/traces",
  },
  {
    name: "OTEL_EXPORTER_OTLP_ENDPOINT carrying the OTLP path",
    env: { OTEL_EXPORTER_OTLP_ENDPOINT: "http://otlp/v1/traces" },
    apiBaseUrl: "http://otlp",
    traceExportEndpoint: "http://otlp/v1/traces",
    traceExportShape: "base-or-full",
    traceExportUrl: "http://otlp/v1/traces",
  },
  {
    name: "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT is exported to verbatim",
    env: { OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "http://otlp/custom/traces" },
    apiBaseUrl: undefined,
    traceExportEndpoint: "http://otlp/custom/traces",
    traceExportShape: "fully-qualified",
    traceExportUrl: "http://otlp/custom/traces",
  },
  {
    name: "PHOENIX_COLLECTOR_ENDPOINT outranks OTEL_EXPORTER_OTLP_TRACES_ENDPOINT",
    env: {
      PHOENIX_COLLECTOR_ENDPOINT: "http://col",
      OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "http://otlp/custom/traces",
    },
    apiBaseUrl: "http://col",
    traceExportEndpoint: "http://col",
    traceExportShape: "base-or-full",
    traceExportUrl: "http://col/v1/traces",
  },
  {
    name: "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT outranks PHOENIX_ENDPOINT",
    env: {
      PHOENIX_ENDPOINT: "http://api",
      OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "http://otlp/custom/traces",
    },
    apiBaseUrl: "http://api",
    traceExportEndpoint: "http://otlp/custom/traces",
    traceExportShape: "fully-qualified",
    traceExportUrl: "http://otlp/custom/traces",
  },
  {
    name: "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT outranks OTEL_EXPORTER_OTLP_ENDPOINT",
    env: {
      OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "http://otlp/custom/traces",
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://otlp",
    },
    apiBaseUrl: "http://otlp",
    traceExportEndpoint: "http://otlp/custom/traces",
    traceExportShape: "fully-qualified",
    traceExportUrl: "http://otlp/custom/traces",
  },
  {
    name: "an empty PHOENIX_ENDPOINT counts as unset",
    env: { PHOENIX_ENDPOINT: "" },
    apiBaseUrl: undefined,
    traceExportEndpoint: undefined,
    traceExportUrl: DEFAULT_TRACE_EXPORT_URL,
  },
  {
    name: "an empty PHOENIX_ENDPOINT falls through to PHOENIX_COLLECTOR_ENDPOINT",
    env: { PHOENIX_ENDPOINT: "", PHOENIX_COLLECTOR_ENDPOINT: "http://col" },
    apiBaseUrl: "http://col",
    traceExportEndpoint: "http://col",
    traceExportShape: "base-or-full",
    traceExportUrl: "http://col/v1/traces",
  },
  {
    name: "an empty PHOENIX_COLLECTOR_ENDPOINT falls through to PHOENIX_ENDPOINT",
    env: { PHOENIX_COLLECTOR_ENDPOINT: "", PHOENIX_ENDPOINT: "http://api" },
    apiBaseUrl: "http://api",
    traceExportEndpoint: "http://api",
    traceExportShape: "base-or-full",
    traceExportUrl: "http://api/v1/traces",
  },
  {
    name: "a whitespace-only PHOENIX_ENDPOINT falls through to PHOENIX_HOST",
    env: { PHOENIX_ENDPOINT: "   ", PHOENIX_HOST: "http://legacy" },
    apiBaseUrl: "http://legacy",
    traceExportEndpoint: undefined,
    traceExportUrl: DEFAULT_TRACE_EXPORT_URL,
  },
  {
    name: "a bare PHOENIX_HOST bind address with PHOENIX_PORT",
    env: { PHOENIX_HOST: "0.0.0.0", PHOENIX_PORT: "7007" },
    apiBaseUrl: "http://127.0.0.1:7007",
    traceExportEndpoint: undefined,
    traceExportUrl: DEFAULT_TRACE_EXPORT_URL,
  },
  {
    name: "a bare PHOENIX_HOST without a port",
    env: { PHOENIX_HOST: "phoenix.internal" },
    apiBaseUrl: "http://phoenix.internal:6006",
    traceExportEndpoint: undefined,
    traceExportUrl: DEFAULT_TRACE_EXPORT_URL,
  },
  {
    name: "PHOENIX_COLLECTOR_ENDPOINT outranks the legacy PHOENIX_HOST",
    env: {
      PHOENIX_HOST: "http://legacy",
      PHOENIX_COLLECTOR_ENDPOINT: "http://col",
    },
    apiBaseUrl: "http://col",
    traceExportEndpoint: "http://col",
    traceExportShape: "base-or-full",
    traceExportUrl: "http://col/v1/traces",
  },
  {
    name: "a trailing slash after the OTLP path",
    env: { PHOENIX_COLLECTOR_ENDPOINT: "http://col/v1/traces/" },
    apiBaseUrl: "http://col",
    traceExportEndpoint: "http://col/v1/traces/",
    traceExportShape: "base-or-full",
    traceExportUrl: "http://col/v1/traces",
  },
  {
    name: "a doubled separator before the OTLP path",
    env: { PHOENIX_COLLECTOR_ENDPOINT: "http://col//v1/traces" },
    apiBaseUrl: "http://col",
    traceExportEndpoint: "http://col//v1/traces",
    traceExportShape: "base-or-full",
    traceExportUrl: "http://col/v1/traces",
  },
  {
    name: "a query string after the OTLP path",
    env: { PHOENIX_COLLECTOR_ENDPOINT: "http://col/v1/traces?tenant=a" },
    apiBaseUrl: "http://col?tenant=a",
    traceExportEndpoint: "http://col/v1/traces?tenant=a",
    traceExportShape: "base-or-full",
    traceExportUrl: "http://col/v1/traces?tenant=a",
  },
  {
    // URL paths are case-sensitive, so an upper-case path is somebody's real
    // route rather than the OTLP one: it is neither stripped nor treated as
    // already carrying the traces path.
    name: "an upper-case /V1/traces path is left alone",
    env: { PHOENIX_COLLECTOR_ENDPOINT: "http://col/V1/traces" },
    apiBaseUrl: "http://col/V1/traces",
    traceExportEndpoint: "http://col/V1/traces",
    traceExportShape: "base-or-full",
    traceExportUrl: "http://col/V1/traces/v1/traces",
  },
  {
    name: "a path prefix before the OTLP path is preserved",
    env: { PHOENIX_COLLECTOR_ENDPOINT: "http://col/api/v1/traces" },
    apiBaseUrl: "http://col/api",
    traceExportEndpoint: "http://col/api/v1/traces",
    traceExportShape: "base-or-full",
    traceExportUrl: "http://col/api/v1/traces",
  },
  {
    name: "a trailing slash on PHOENIX_ENDPOINT is kept for API access",
    env: { PHOENIX_ENDPOINT: "http://api/" },
    apiBaseUrl: "http://api/",
    traceExportEndpoint: "http://api/",
    traceExportShape: "base-or-full",
    traceExportUrl: "http://api/v1/traces",
  },
  {
    // PHOENIX_ENDPOINT is defined as a base URL, so a suffixed value is a
    // mistake that is honored as written rather than silently rewritten.
    name: "an OTLP path on PHOENIX_ENDPOINT is not stripped",
    env: { PHOENIX_ENDPOINT: "http://api/v1/traces" },
    apiBaseUrl: "http://api/v1/traces",
    traceExportEndpoint: "http://api/v1/traces",
    traceExportShape: "base-or-full",
    traceExportUrl: "http://api/v1/traces",
  },
];

/** Every variable any row sets, so one row cannot leak into the next. */
const CONFORMANCE_TABLE_ENV_KEYS = [
  ...new Set(
    ENDPOINT_RESOLUTION_CONFORMANCE_TABLE.flatMap((row) => Object.keys(row.env))
  ),
];

const DEFAULT_BASE_URL = "http://localhost:6006";

describe("endpoint resolution conformance table", () => {
  beforeEach(() => {
    process.env.PHOENIX_DISCOVER_CONFIG = "false";
    clearPhoenixConnectionEnvForTesting();
    for (const envKey of CONFORMANCE_TABLE_ENV_KEYS) {
      delete process.env[envKey];
    }
    // A losing PHOENIX_HOST warns once; the message is asserted in
    // @arizeai/phoenix-config.
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  for (const row of ENDPOINT_RESOLUTION_CONFORMANCE_TABLE) {
    it(`sends API calls to the base URL resolved from ${row.name}`, () => {
      Object.assign(process.env, row.env);
      const client = createClient();
      expect(client.config.baseUrl).toBe(row.apiBaseUrl ?? DEFAULT_BASE_URL);
      expect(client.config.baseUrlSource).toBe(
        row.apiBaseUrl === undefined ? "default" : "environment"
      );
    });
  }
});
