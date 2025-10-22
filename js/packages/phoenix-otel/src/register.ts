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

type RegisterParams = {
  /**
   * The project the spans should be associated to
   * @default "default"
   */
  projectName?: string;
  /**
   * the URL to the phoenix OTEL endpoint
   * If not provided, environment variables are checked.
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
  useBatchSpanProcessor?: boolean;
  /**
   * Whether to set the tracer as a global provider.
   * @default true
   */
  setGlobalTracerProvider?: boolean;
};

export function register({
  url: paramsUrl,
  apiKey: paramsApiKey,
  projectName = "default",
  useBatchSpanProcessor = true,
  setGlobalTracerProvider = true,
}: RegisterParams) {
  const url = paramsUrl || getEnvCollectorURL();
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
  if (useBatchSpanProcessor) {
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

  if (setGlobalTracerProvider) {
    provider.register();
  }
  return provider;
}
