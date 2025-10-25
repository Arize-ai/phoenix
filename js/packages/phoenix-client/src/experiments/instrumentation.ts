import { HeadersOptions } from "openapi-fetch";
import { register, DiagLogLevel } from "@arizeai/phoenix-otel";

/**
 * Creates a provider that exports traces to Phoenix.
 */
export function createProvider({
  projectName,
  baseUrl,
  headers,
  useBatchSpanProcessor = true,
  diagLogLevel,
}: {
  projectName: string;
  headers: HeadersOptions;
  /**
   * Whether to use batching for the span processor.
   * @default true
   */
  useBatchSpanProcessor: boolean;
  /**
   * The base URL of the Phoenix. Doesn't include the /v1/traces path.
   */
  baseUrl: string;
  /**
   * The diag log level to set for the built in DiagConsoleLogger instance.
   * Omit to disable built in logging.
   */
  diagLogLevel?: DiagLogLevel;
}) {
  const provider = register({
    url: baseUrl,
    projectName,
    batch: useBatchSpanProcessor,
    headers: Array.isArray(headers) ? Object.fromEntries(headers) : headers,
    diagLogLevel,
    global: false, // don't set global here. Delegate to higher up
  });
  return provider;
}

export { createNoOpProvider } from "@arizeai/phoenix-otel";
