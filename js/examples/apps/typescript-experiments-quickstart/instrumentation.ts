import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { SEMRESATTRS_PROJECT_NAME } from "@arizeai/openinference-semantic-conventions";
import { OpenInferenceSimpleSpanProcessor } from "@arizeai/openinference-vercel";

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

const ENDPOINT = process.env.PHOENIX_HOST;
const SERVICE_NAME = "experiments-tutorial-ts";

if (!ENDPOINT) {
  console.warn("⚠️  PHOENIX_HOST not set, tracing will not be enabled");
} else {
  const headers: Record<string, string> = {};
  if (process.env.PHOENIX_API_KEY) {
    headers.Authorization = `Bearer ${process.env.PHOENIX_API_KEY}`;
  }

  const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: SERVICE_NAME,
      [SEMRESATTRS_PROJECT_NAME]: SERVICE_NAME,
    }),
    spanProcessors: [
      new OpenInferenceSimpleSpanProcessor({
        exporter: new OTLPTraceExporter({
          url: `${ENDPOINT}/v1/traces`,
          headers,
        }),
      }),
    ],
  });

  provider.register();

  console.log("✅ Tracer provider registered");
}
