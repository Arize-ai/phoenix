/**
 * Phoenix Tracing Tutorial - Instrumentation Setup
 *
 * This file configures OpenTelemetry to send traces to Phoenix.
 * Import this file at the top of each tutorial script to enable tracing.
 */

import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { SEMRESATTRS_PROJECT_NAME } from "@arizeai/openinference-semantic-conventions";
import { OpenInferenceSimpleSpanProcessor } from "@arizeai/openinference-vercel";

// Enable debug logging for troubleshooting (set to ERROR in production)
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

// Phoenix collector endpoint - defaults to local Phoenix instance
const COLLECTOR_ENDPOINT =
  process.env.PHOENIX_COLLECTOR_ENDPOINT || "http://localhost:6006";

// Project name that will appear in Phoenix UI
const PROJECT_NAME = "support-bot";

// Create and configure the tracer provider
export const provider = new NodeTracerProvider({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: PROJECT_NAME,
    [SEMRESATTRS_PROJECT_NAME]: PROJECT_NAME,
  }),
  spanProcessors: [
    new OpenInferenceSimpleSpanProcessor({
      exporter: new OTLPTraceExporter({
        url: `${COLLECTOR_ENDPOINT}/v1/traces`,
        // Uncomment if using Phoenix Cloud or authenticated Phoenix:
        // headers: { Authorization: `Bearer ${process.env.PHOENIX_API_KEY}` },
      }),
    }),
  ],
});

// Register the provider globally
provider.register();

console.log("✅ Phoenix tracing enabled");
console.log(`   Sending traces to: ${COLLECTOR_ENDPOINT}`);
console.log(`   Project: ${PROJECT_NAME}`);
console.log("");
