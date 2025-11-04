import { SEMRESATTRS_PROJECT_NAME } from "@arizeai/openinference-semantic-conventions";
import {
  OpenInferenceBatchSpanProcessor,
  OpenInferenceSimpleSpanProcessor,
} from "@arizeai/openinference-vercel";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  NodeTracerProvider,
  SpanProcessor,
} from "@opentelemetry/sdk-trace-node";
import { getEnvApiKey, getEnvCollectorURL } from "./config";
import {
  Instrumentation,
  registerInstrumentations,
} from "@opentelemetry/instrumentation";
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";

/**
 * Type definition for HTTP headers used in OTLP communication
 * @example { "custom-header": "value", "x-api-version": "1.0" }
 */
export type Headers = Record<string, string>;

/**
 * Configuration parameters for registering Phoenix OpenTelemetry tracing.
 *
 * This interface defines all the available options for configuring the Phoenix
 * OpenTelemetry integration, including connection details, processing options,
 * and instrumentation settings.
 *
 * @example
 * ```typescript
 * const config: RegisterParams = {
 *   projectName: "my-application",
 *   url: "https://app.phoenix.arize.com",
 *   apiKey: "your-api-key",
 *   batch: true,
 *   global: true
 * };
 * ```
 */
export type RegisterParams = {
  /**
   * The project name that spans will be associated with in Phoenix.
   * This helps organize and filter traces in the Phoenix UI.
   *
   * @default "default"
   * @example "my-web-app"
   * @example "api-service"
   */
  projectName?: string;

  /**
   * The URL to the Phoenix server. Can be postfixed with the tracing path.
   * If not provided, the system will check the PHOENIX_COLLECTOR_URL environment variable.
   *
   * The URL will be automatically normalized to include the `/v1/traces` endpoint if not present.
   *
   * @example "https://app.phoenix.arize.com"
   * @example "https://app.phoenix.arize.com/v1/traces"
   * @example "http://localhost:6006"
   */
  url?: string;

  /**
   * The API key for authenticating with the Phoenix instance.
   * If not provided, the system will check the PHOENIX_API_KEY environment variable.
   *
   * The API key will be automatically added to the Authorization header as a Bearer token.
   *
   * @example "phx_1234567890abcdef"
   */
  apiKey?: string;

  /**
   * Additional headers to be included when communicating with the OTLP collector.
   * These headers will be merged with any automatically generated headers (like Authorization).
   *
   * @example { "x-custom-header": "value", "x-api-version": "1.0" }
   */
  headers?: Headers;

  /**
   * Whether to use batching for span processing.
   *
   * - `true` (default): Uses OpenInferenceBatchSpanProcessor for better performance in production
   * - `false`: Uses OpenInferenceSimpleSpanProcessor for immediate span export (useful for debugging)
   *
   * Batching is recommended for production environments as it reduces network overhead
   * and improves performance by sending multiple spans in a single request.
   *
   * @default true
   */
  batch?: boolean;

  /**
   * A list of OpenTelemetry instrumentations to automatically register.
   *
   * **Note**: This feature may only work with CommonJS projects. ESM projects
   * may require manual instrumentation registration.
   *
   * @example
   * ```typescript
   * import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
   * import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
   *
   * const instrumentations = [
   *   new HttpInstrumentation(),
   *   new ExpressInstrumentation()
   * ];
   * ```
   */
  instrumentations?: Instrumentation[];

  /**
   * Custom span processors to add to the tracer provider.
   *
   * **Important**: When provided, this will override the default span processor
   * created from the `url`, `apiKey`, `headers`, and `batch` parameters.
   *
   * @example
   * ```typescript
   * import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
   *
   * const customProcessors = [
   *   new BatchSpanProcessor(exporter),
   *   new MyCustomSpanProcessor()
   * ];
   * ```
   */
  spanProcessors?: SpanProcessor[];

  /**
   * Whether to register the tracer provider as the global provider.
   *
   * When `true` (default), the provider will be registered globally and can be
   * accessed throughout the application. Set to `false` if you want to manage
   * the provider lifecycle manually or use multiple providers.
   *
   * @default true
   */
  global?: boolean;

  /**
   * The diagnostic log level for the built-in DiagConsoleLogger.
   *
   * This controls the verbosity of OpenTelemetry's internal logging.
   * Omit this parameter to disable built-in logging entirely.
   *
   * @example DiagLogLevel.INFO
   * @example DiagLogLevel.DEBUG
   * @example DiagLogLevel.ERROR
   */
  diagLogLevel?: DiagLogLevel;
};

/**
 * Registers Phoenix OpenTelemetry tracing with the specified configuration.
 *
 * This function sets up a complete OpenTelemetry tracing pipeline configured
 * to send traces to a Phoenix instance. It creates a NodeTracerProvider with
 * appropriate span processors, resource attributes, and optional instrumentations.
 *
 * The function handles:
 * - Creating and configuring a NodeTracerProvider
 * - Setting up OTLP trace export to Phoenix
 * - Configuring span processors (batch or simple)
 * - Registering instrumentations (if provided)
 * - Setting up resource attributes for project identification
 * - Optional global provider registration
 *
 * @param params - Configuration parameters for Phoenix tracing
 * @returns The configured NodeTracerProvider instance that can be used to create traces
 *
 * @example
 * Basic usage with minimal configuration:
 * ```typescript
 * import { register } from '@arizeai/phoenix-otel';
 *
 * // Uses environment variables for URL and API key
 * const provider = register({
 *   projectName: 'my-application'
 * });
 * ```
 *
 * @example
 * Full configuration with custom settings:
 * ```typescript
 * import { register } from '@arizeai/phoenix-otel';
 * import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
 * import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
 *
 * const provider = register({
 *   projectName: 'my-web-app',
 *   url: 'https://app.phoenix.arize.com',
 *   apiKey: 'phx_1234567890abcdef',
 *   batch: true,
 *   global: true,
 *   instrumentations: [
 *     new HttpInstrumentation(),
 *     new ExpressInstrumentation()
 *   ],
 *   diagLogLevel: DiagLogLevel.INFO
 * });
 * ```
 *
 * @example
 * Custom span processors:
 * ```typescript
 * import { register } from '@arizeai/phoenix-otel';
 * import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
 * import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
 *
 * const exporter = new OTLPTraceExporter({
 *   url: 'https://app.phoenix.arize.com/v1/traces',
 *   headers: { 'Authorization': 'Bearer your-api-key' }
 * });
 *
 * const provider = register({
 *   projectName: 'my-app',
 *   spanProcessors: [new BatchSpanProcessor(exporter)],
 *   global: false // Manual provider management
 * });
 * ```
 *
 * @example
 * Debugging configuration:
 * ```typescript
 * const provider = register({
 *   projectName: 'debug-app',
 *   url: 'http://localhost:6006',
 *   batch: false, // Immediate span export for debugging
 *   diagLogLevel: DiagLogLevel.DEBUG
 * });
 * ```
 */
export function register(params: RegisterParams): NodeTracerProvider {
  const {
    projectName = "default",
    instrumentations,
    global = true,
    diagLogLevel,
    spanProcessors,
  } = params;

  if (diagLogLevel) {
    diag.setLogger(new DiagConsoleLogger(), diagLogLevel);
  }
  const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({
      [SEMRESATTRS_PROJECT_NAME]: projectName,
    }),
    spanProcessors: spanProcessors || [getDefaultSpanProcessor(params)],
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
 * Creates a default span processor configured for Phoenix OpenTelemetry tracing.
 *
 * This function creates an appropriate span processor (batch or simple) based on
 * the provided configuration parameters. It handles URL normalization, header
 * configuration, and API key authentication automatically.
 *
 * The function will:
 * - Normalize the collector URL to include the `/v1/traces` endpoint if needed
 * - Configure authentication headers using the provided API key
 * - Merge any additional custom headers
 * - Create either a batch or simple span processor based on the `batch` parameter
 *
 * @param params - Configuration parameters for the span processor
 * @param params.url - The URL to the Phoenix server (will be normalized to include `/v1/traces`)
 * @param params.apiKey - The API key for authenticating with the Phoenix instance
 * @param params.headers - Additional headers to include in OTLP requests
 * @param params.batch - Whether to use batching for span processing (recommended for production)
 * @returns A configured SpanProcessor instance ready for use with a NodeTracerProvider
 *
 * @example
 * Basic usage with environment variables:
 * ```typescript
 * const processor = getDefaultSpanProcessor({
 *   batch: true
 * });
 * ```
 *
 * @example
 * Full configuration with custom settings:
 * ```typescript
 * const processor = getDefaultSpanProcessor({
 *   url: 'https://app.phoenix.arize.com',
 *   apiKey: 'phx_1234567890abcdef',
 *   headers: { 'x-custom-header': 'value' },
 *   batch: true
 * });
 * ```
 *
 * @example
 * Debugging configuration with immediate export:
 * ```typescript
 * const processor = getDefaultSpanProcessor({
 *   url: 'http://localhost:6006',
 *   batch: false // Immediate span export for debugging
 * });
 * ```
 *
 * @example
 * Using with custom headers:
 * ```typescript
 * const processor = getDefaultSpanProcessor({
 *   url: 'https://app.phoenix.arize.com',
 *   apiKey: 'your-api-key',
 *   headers: {
 *     'x-api-version': '1.0',
 *     'x-client-name': 'my-app'
 *   },
 *   batch: true
 * });
 * ```
 */
export function getDefaultSpanProcessor({
  url: paramsUrl,
  apiKey: paramsApiKey,
  headers: paramsHeaders = {},
  batch = true,
}: Pick<
  RegisterParams,
  "url" | "apiKey" | "batch" | "headers"
>): SpanProcessor {
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
  return spanProcessor;
}
/**
 * Normalizes a Phoenix server URL to ensure it includes the correct OTLP traces endpoint.
 *
 * This utility function ensures that any Phoenix server URL is properly formatted
 * to include the `/v1/traces` endpoint required for OTLP trace export. It handles
 * various URL formats and automatically appends the endpoint if missing.
 *
 * The function:
 * - Checks if the URL already contains `/v1/traces`
 * - If missing, appends `/v1/traces` to the base URL
 * - Returns a properly formatted URL string
 * - Assumes HTTP over gRPC protocol for OTLP communication
 *
 * @param url - The base URL to the Phoenix server (may or may not include the traces endpoint)
 * @returns A normalized URL string that includes the `/v1/traces` endpoint
 *
 * @example
 * URL without traces endpoint:
 * ```typescript
 * const normalized = ensureCollectorEndpoint('https://app.phoenix.arize.com');
 * // Returns: 'https://app.phoenix.arize.com/v1/traces'
 * ```
 *
 * @example
 * URL that already includes traces endpoint:
 * ```typescript
 * const normalized = ensureCollectorEndpoint('https://app.phoenix.arize.com/v1/traces');
 * // Returns: 'https://app.phoenix.arize.com/v1/traces'
 * ```
 *
 * @example
 * Local development URL:
 * ```typescript
 * const normalized = ensureCollectorEndpoint('http://localhost:6006');
 * // Returns: 'http://localhost:6006/v1/traces'
 * ```
 *
 * @example
 * URL with custom port and path:
 * ```typescript
 * const normalized = ensureCollectorEndpoint('https://phoenix.example.com:8080');
 * // Returns: 'https://phoenix.example.com:8080/v1/traces'
 * ```
 *
 * @example
 * URL with existing path (edge case):
 * ```typescript
 * const normalized = ensureCollectorEndpoint('https://app.phoenix.arize.com/api');
 * // Returns: 'https://app.phoenix.arize.com/api/v1/traces'
 * ```
 */
export function ensureCollectorEndpoint(url: string): string {
  if (!url.includes("/v1/traces")) {
    return new URL("/v1/traces", url).toString();
  }
  return new URL(url).toString();
}
