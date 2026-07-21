import { SEMRESATTRS_PROJECT_NAME } from "@arizeai/openinference-semantic-conventions";
import type { SpanFilter } from "@arizeai/openinference-vercel" with {
  "resolution-mode": "import",
};
import { warnIfUsingFileEndpointWithCredentials } from "@arizeai/phoenix-config";
import type { DiagLogLevel } from "@opentelemetry/api";
import {
  context,
  type ContextManager,
  diag,
  DiagConsoleLogger,
  propagation,
  type TextMapPropagator,
  trace,
  type TracerProvider,
} from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import {
  CompositePropagator,
  W3CBaggagePropagator,
  W3CTraceContextPropagator,
} from "@opentelemetry/core";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import type { Instrumentation } from "@opentelemetry/instrumentation";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { resourceFromAttributes } from "@opentelemetry/resources";
import type { SpanProcessor } from "@opentelemetry/sdk-trace-node";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";

import { getEnvConfig, getEnvProjectName } from "./config";
import { LazyOpenInferenceSpanProcessor } from "./lazyOpenInferenceSpanProcessor";

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
   * If not provided, the system will check the `PHOENIX_PROJECT` environment
   * variable (canonical) and then the `PHOENIX_PROJECT_NAME` alias, falling
   * back to `"default"` if neither is set.
   *
   * @default "default"
   * @example "my-web-app"
   * @example "api-service"
   */
  projectName?: string;

  /**
   * The URL to the Phoenix server. Can be postfixed with the tracing path.
   * If not provided, the system will check the PHOENIX_COLLECTOR_ENDPOINT environment variable.
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
   * A predicate applied to each span before export; only spans it returns
   * `true` for are sent to Phoenix.
   *
   * Use `isOpenInferenceSpan` from `@arizeai/openinference-vercel` to keep
   * only AI spans and drop infrastructure spans (HTTP requests, framework
   * workflow internals) that would otherwise clutter the Phoenix trace view.
   * Combine with {@link reparentOrphanedSpans} so AI spans whose parents are
   * filtered out are re-rooted instead of appearing orphaned.
   *
   * Ignored when {@link spanProcessors} is provided.
   *
   * @example
   * ```typescript
   * import { isOpenInferenceSpan } from "@arizeai/openinference-vercel";
   *
   * register({
   *   projectName: "my-agent",
   *   spanFilter: isOpenInferenceSpan,
   *   reparentOrphanedSpans: true,
   * });
   * ```
   */
  spanFilter?: SpanFilter;

  /**
   * Whether to re-root AI spans whose parent spans were dropped by
   * {@link spanFilter}, so each trace shows a clean root instead of spans
   * pointing at a parent that was never exported.
   *
   * Ignored when {@link spanProcessors} is provided.
   *
   * @default false
   */
  reparentOrphanedSpans?: boolean;

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

export type GlobalTracerProviderRegistration = {
  /**
   * Detach the global tracer provider and reset global tracing APIs to no-op state.
   *
   * This clears the OpenTelemetry tracer provider, context manager, and propagator
   * so a different provider can be attached later in the same process.
   */
  detach: () => void;
};

type GlobalTelemetrySnapshot = {
  contextManager?: ContextManager;
  propagator?: TextMapPropagator;
  tracerProvider?: TracerProvider;
};

type OpenTelemetryGlobalState = {
  context?: ContextManager;
  propagation?: TextMapPropagator;
  trace?: TracerProvider;
  version?: string;
};

type GlobalTracerProviderMount = {
  id: number;
  provider: NodeTracerProvider;
};

let nextGlobalTracerProviderMountId = 0;
let managedGlobalBaseSnapshot: GlobalTelemetrySnapshot | null = null;
const managedGlobalTracerProviderMounts: GlobalTracerProviderMount[] = [];
// OpenTelemetry v1 stores globals on this well-known symbol.
const OTEL_GLOBAL_SYMBOL = Symbol.for("opentelemetry.js.api.1");

function getOpenTelemetryGlobalState(): OpenTelemetryGlobalState | undefined {
  return (
    globalThis as typeof globalThis & {
      [OTEL_GLOBAL_SYMBOL]?: OpenTelemetryGlobalState;
    }
  )[OTEL_GLOBAL_SYMBOL];
}

function getGlobalTelemetrySnapshot(): GlobalTelemetrySnapshot {
  const globalState = getOpenTelemetryGlobalState();

  return {
    tracerProvider: globalState?.trace,
    contextManager: globalState?.context,
    propagator: globalState?.propagation,
  };
}

function clearGlobalTelemetry(): void {
  trace.disable();
  context.disable();
  propagation.disable();
}

function restoreGlobalTelemetrySnapshot(
  snapshot: GlobalTelemetrySnapshot | null
): void {
  clearGlobalTelemetry();

  if (!snapshot) {
    return;
  }

  if (snapshot.tracerProvider) {
    trace.setGlobalTracerProvider(snapshot.tracerProvider);
  }

  if (snapshot.contextManager) {
    context.setGlobalContextManager(snapshot.contextManager);
  }

  if (snapshot.propagator) {
    propagation.setGlobalPropagator(snapshot.propagator);
  }
}

/**
 * Sets the given provider as the global OpenTelemetry provider using this
 * module's own imports of `trace`, `context`, and `propagation`.
 *
 * We deliberately avoid calling `provider.register()` because the SDK's
 * internal import of `@opentelemetry/api` may resolve to a different module
 * instance in pnpm workspaces (different symlink paths → different module
 * identity). By routing all global-state mutations through **our** copy of
 * the OTEL API, snapshot/restore stays consistent.
 */
function setGlobalProvider(provider: NodeTracerProvider): void {
  trace.setGlobalTracerProvider(provider);

  const contextManager = new AsyncLocalStorageContextManager();
  contextManager.enable();
  context.setGlobalContextManager(contextManager);

  propagation.setGlobalPropagator(
    new CompositePropagator({
      propagators: [
        new W3CTraceContextPropagator(),
        new W3CBaggagePropagator(),
      ],
    })
  );
}

function restorePreviousManagedGlobalTracerProvider(): void {
  const previousMount =
    managedGlobalTracerProviderMounts[
      managedGlobalTracerProviderMounts.length - 1
    ];

  if (previousMount) {
    clearGlobalTelemetry();
    setGlobalProvider(previousMount.provider);
    return;
  }

  restoreGlobalTelemetrySnapshot(managedGlobalBaseSnapshot);
  managedGlobalBaseSnapshot = null;
}

function detachManagedGlobalTracerProvider(mountId?: number): void {
  if (managedGlobalTracerProviderMounts.length === 0) {
    clearGlobalTelemetry();
    return;
  }

  const mountIndex =
    mountId == null
      ? managedGlobalTracerProviderMounts.length - 1
      : managedGlobalTracerProviderMounts.findIndex(
          (mount) => mount.id === mountId
        );

  if (mountIndex === -1) {
    return;
  }

  const isTopMount =
    mountIndex === managedGlobalTracerProviderMounts.length - 1;
  managedGlobalTracerProviderMounts.splice(mountIndex, 1);

  if (!isTopMount) {
    return;
  }

  restorePreviousManagedGlobalTracerProvider();
}

/**
 * Detaches the current global OpenTelemetry tracer provider and resets the
 * global trace, context, and propagation APIs.
 */
export function detachGlobalTracerProvider(): void {
  detachManagedGlobalTracerProvider();
}

/**
 * Attaches an existing tracer provider as the global OpenTelemetry provider.
 *
 * Returns a handle that can be used to detach it later so another provider can
 * be attached in the same process.
 */
export function attachGlobalTracerProvider(
  provider: NodeTracerProvider
): GlobalTracerProviderRegistration {
  if (managedGlobalTracerProviderMounts.length === 0) {
    managedGlobalBaseSnapshot = getGlobalTelemetrySnapshot();
  }

  const mountId = nextGlobalTracerProviderMountId++;
  managedGlobalTracerProviderMounts.push({
    id: mountId,
    provider,
  });

  clearGlobalTelemetry();
  setGlobalProvider(provider);

  return {
    detach: () => {
      detachManagedGlobalTracerProvider(mountId);
    },
  };
}

function bindGlobalTracerProviderRegistrationToShutdown({
  provider,
  registration,
}: {
  provider: NodeTracerProvider;
  registration: GlobalTracerProviderRegistration;
}): void {
  const shutdown = provider.shutdown.bind(provider);
  let hasDetachedRegistration = false;

  provider.shutdown = async (): Promise<void> => {
    if (!hasDetachedRegistration) {
      hasDetachedRegistration = true;
      registration.detach();
    }

    await shutdown();
  };
}

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
 * import { DiagLogLevel, register } from '@arizeai/phoenix-otel';
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
 * import { DiagLogLevel, register } from '@arizeai/phoenix-otel';
 *
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
    projectName = getEnvProjectName() ?? "default",
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
    const registration = attachGlobalTracerProvider(provider);
    bindGlobalTracerProviderRegistrationToShutdown({
      provider,
      registration,
    });
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
  spanFilter,
  reparentOrphanedSpans,
}: Pick<
  RegisterParams,
  | "url"
  | "apiKey"
  | "batch"
  | "headers"
  | "spanFilter"
  | "reparentOrphanedSpans"
>): SpanProcessor {
  const envConfig = getEnvConfig();
  const configuredUrl = paramsUrl || envConfig.endpoint.value;
  let url: string;
  try {
    url = ensureCollectorEndpoint(configuredUrl || "http://localhost:6006");
  } catch (error) {
    if (!paramsUrl && envConfig.endpoint.source?.kind === "env-file") {
      // eslint-disable-next-line no-console
      console.warn(
        `Ignoring invalid PHOENIX_COLLECTOR_ENDPOINT value from ${envConfig.endpoint.source.filePath}: ${error instanceof Error ? error.message : "invalid URL"}.`
      );
      url = ensureCollectorEndpoint("http://localhost:6006");
    } else {
      throw error;
    }
  }
  const apiKey = paramsApiKey || envConfig.credentials.apiKey;
  const explicitHeaders: Headers = Array.isArray(paramsHeaders)
    ? Object.fromEntries(paramsHeaders)
    : { ...paramsHeaders };
  const headers: Headers = { ...envConfig.credentials.headers };
  for (const [key, value] of Object.entries(explicitHeaders)) {
    const existingKey = Object.keys(headers).find(
      (header) => header.toLowerCase() === key.toLowerCase()
    );
    if (existingKey) {
      delete headers[existingKey];
    }
    headers[key] = value;
  }
  const hasExplicitAuthorization = Object.keys(explicitHeaders).some(
    (key) => key.toLowerCase() === "authorization"
  );
  if (typeof paramsApiKey === "string" && !hasExplicitAuthorization) {
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === "authorization") {
        delete headers[key];
      }
    }
  }
  const hasExplicitCredentials =
    typeof paramsApiKey === "string" || Object.keys(explicitHeaders).length > 0;
  const credentialSource = hasExplicitCredentials
    ? "explicit arguments"
    : envConfig.credentials.source?.kind === "process"
      ? "the process environment"
      : undefined;
  if (!paramsUrl) {
    warnIfUsingFileEndpointWithCredentials({
      credentialSource,
      endpointSource: envConfig.endpoint.source,
      endpointVariable: "PHOENIX_COLLECTOR_ENDPOINT",
    });
  }
  const configureHeaders =
    typeof apiKey === "string" &&
    !Object.keys(headers).some((key) => key.toLowerCase() === "authorization");
  if (configureHeaders) {
    headers["authorization"] = `Bearer ${apiKey}`;
  }
  const exporter = new OTLPTraceExporter({
    url,
    headers,
  });
  // The OpenInference span processors come from the ESM-only
  // `@arizeai/openinference-vercel` package; the lazy processor loads them
  // with a dynamic import so this module stays loadable from CommonJS.
  const spanProcessor: SpanProcessor = new LazyOpenInferenceSpanProcessor({
    exporter,
    batch,
    spanFilter,
    reparentOrphanedSpans,
  });
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
 * - The `/v1/traces` path is the standard endpoint for OTLP/HTTP trace export
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
    // Ensure the base URL has a trailing slash for proper path concatenation
    // Without this, the URL constructor treats the last segment as a file and replaces it
    const baseUrl = new URL(url);
    if (!baseUrl.pathname.endsWith("/")) {
      baseUrl.pathname += "/";
    }
    // Append v1/traces to the pathname (without leading slash to append, not replace)
    baseUrl.pathname += "v1/traces";
    return baseUrl.toString();
  }
  return new URL(url).toString();
}
