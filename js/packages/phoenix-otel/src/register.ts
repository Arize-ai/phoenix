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

export type RegisterParams = {
  /**
   * The project the spans should be associated to
   * @default "default"
   */
  projectName?: string;
  /**
   * the URL to the phoenix server. Can be postfixed with tracing path.
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
   * Whether to use batching for span processing.
   * It is recommended to use batching in production environments
   * @default true
   */
  /**
   * A list of instrumenation to register.
   * Note: this may only work with commonjs projects. ESM projects will require manually applying instrumentation.
   */
  instrumentations?: Instrumentation[];
  batch?: boolean;
  /**
   * Whether to set the tracer as a global provider.
   * @default true
   */
  global?: boolean;
};

export function register({
  url: paramsUrl,
  apiKey: paramsApiKey,
  projectName = "default",
  instrumentations,
  batch = true,
  global = true,
}: RegisterParams) {
  const url = ensureCollectorEndpoint(
    paramsUrl || getEnvCollectorURL() || "http://localhost:6006"
  );
  const apiKey = paramsApiKey || getEnvApiKey();
  const headers: Record<string, string> = {};
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

  if (global) {
    provider.register();
  }
  if (instrumentations) {
    registerInstrumentations({
      instrumentations,
    });
  }
  return provider;
}

/**
 * A utility method to normalize the url to be http compatible.
 * Assumes we are using http over gRPC.
 * @param url the url to the phoenix server. May contain a slug
 */
export function ensureCollectorEndpoint(url: string): string {
  if (!url.includes("/v1/traces")) {
    return new URL("/v1/traces", url).toString();
  }
  return new URL(url).toString();
}
