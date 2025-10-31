import { SEMRESATTRS_PROJECT_NAME } from "@arizeai/openinference-semantic-conventions";
import {
  OpenInferenceBatchSpanProcessor,
  OpenInferenceSimpleSpanProcessor,
} from "@arizeai/openinference-vercel";

import { getEnvApiKey, getEnvCollectorURL } from "./config";

import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import {
  Instrumentation,
  registerInstrumentations,
} from "@opentelemetry/instrumentation";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  NodeTracerProvider,
  SpanProcessor,
} from "@opentelemetry/sdk-trace-node";

export type Headers = Record<string, string>;

/**
 * Configuration parameters for registering Phoenix OpenTelemetry tracing
 */
export type RegisterParams = {
  /**
   * The project the spans should be associated to
   * @default "default"
   */
  projectName?: string;
  /**
   * The URL to the phoenix server. Can be postfixed with tracing path.
   * If not provided, environment variables are checked.
   * @example "https://app.phoenix.arize.com"
   */
  url?: string;
  /**
   * The API key for the phoenix instance.
   * If not provided, environment variables are checked.
   */
  apiKey?: string;
  /**
   * Headers to be used when communicating with the OTLP collector
   */
  headers?: Headers;
  /**
   * Whether to use batching for span processing.
   * It is recommended to use batching in production environments
   * @default true
   */
  batch?: boolean;
  /**
   * A list of instrumentation to register.
   * Note: this may only work with commonjs projects. ESM projects will require manually applying instrumentation.
   */
  instrumentations?: Instrumentation[];
  /**
   * Whether to set the tracer as a global provider.
   * @default true
   */
  global?: boolean;
  /**
   * The diag log level to set for the built in DiagConsoleLogger instance.
   * Omit to disable built in logging.
   */
  diagLogLevel?: DiagLogLevel;
};

/**
 * Registers Phoenix OpenTelemetry tracing with the specified configuration
 *
 * @param params - Configuration parameters for Phoenix tracing
 * @param params.url - The URL to the phoenix server. Can be postfixed with tracing path
 * @param params.apiKey - The API key for the phoenix instance
 * @param params.projectName - The project the spans should be associated to
 * @param params.instrumentations - A list of instrumentation to register
 * @param params.batch - Whether to use batching for span processing
 * @param params.global - Whether to set the tracer as a global provider
 * @param params.diagLogLevel - the diagnostics log level
 * @returns {NodeTracerProvider} The configured NodeTracerProvider instance
 *
 * @example
 * ```typescript
 * import { register } from '@arizeai/phoenix-otel';
 *
 * const provider = register({
 *   projectName: 'my-app',
 *   url: 'https://app.phoenix.arize.com',
 *   apiKey: 'your-api-key',
 *   batch: true
 * });
 * ```
 */
export function register({
  url: paramsUrl,
  apiKey: paramsApiKey,
  headers: paramsHeaders = {},
  projectName = "default",
  instrumentations,
  batch = true,
  global = true,
  diagLogLevel,
}: RegisterParams): NodeTracerProvider {
  if (diagLogLevel) {
    diag.setLogger(new DiagConsoleLogger(), diagLogLevel);
  }
  const url = ensureCollectorEndpoint(
    paramsUrl || getEnvCollectorURL() || "http://localhost:6006"
  );
  const apiKey = paramsApiKey || getEnvApiKey();
  const headers: Headers = Array.isArray(paramsHeaders)
    ? Object.fromEntries(paramsHeaders)
    : paramsHeaders;
  const configureHeaders = typeof apiKey == "string";
  if (configureHeaders) {
    headers["authorization"] = `Bearer ${apiKey}`;
  }
  const exporter = new OTLPTraceExporter({
    url,
    headers,
  });
  let spanProcessor: SpanProcessor;
  if (batch) {
    spanProcessor = new OpenInferenceBatchSpanProcessor({ exporter });
  } else {
    spanProcessor = new OpenInferenceSimpleSpanProcessor({ exporter });
  }
  const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({
      [SEMRESATTRS_PROJECT_NAME]: projectName,
    }),
    spanProcessors: [spanProcessor],
  });

  if (instrumentations) {
    registerInstrumentations({
      instrumentations,
      tracerProvider: provider,
    });
  }
  if (global) {
    provider.register();
  }
  return provider;
}

/**
 * A utility method to normalize the URL to be HTTP compatible.
 * Assumes we are using HTTP over gRPC and ensures the URL ends with the correct traces endpoint.
 *
 * @param url - The URL to the phoenix server. May contain a slug
 * @returns {string} The normalized URL with the '/v1/traces' endpoint
 */
export function ensureCollectorEndpoint(url: string): string {
  if (!url.includes("/v1/traces")) {
    return new URL("/v1/traces", url).toString();
  }
  return new URL(url).toString();
}
