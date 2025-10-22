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
import { getEnvCollectorURL } from "./config";

type RegisterParams = {
  /**
   * the project the spans should be associated to
   * @default "default"
   */
  projectName?: string;
  /**
   * the URL to the phoenix OTEL endpoint
   * If not provided, environment variables are checked.
   */
  url?: string;
  /**
   * Whether to use batching for span processing.
   * It is recommended to use batching in production environments
   * @default true
   */
  useBatchSpanProcessor: boolean;
};

export function register({
  url: paramUrl,
  projectName = "default",
  useBatchSpanProcessor,
}: RegisterParams) {
  const url = paramUrl || getEnvCollectorURL();
  const exporter = new OTLPTraceExporter({
    url,
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
  return provider;
}
