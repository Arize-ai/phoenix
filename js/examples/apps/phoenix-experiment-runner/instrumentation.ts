import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { SEMRESATTRS_PROJECT_NAME } from "@arizeai/openinference-semantic-conventions";
import { OpenAIInstrumentation } from "@arizeai/openinference-instrumentation-openai";
import { registerInstrumentations } from "@opentelemetry/instrumentation";

import OpenAI from "openai";

export function instrument({
  projectName,
  headers,
  collectorEndpoint = "http://localhost:6006",
}: {
  projectName?: string;
  headers?: Record<string, string>;
  collectorEndpoint?: string;
}) {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

  const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({
      [SEMRESATTRS_PROJECT_NAME]: projectName,
    }),
    spanProcessors: [
      new SimpleSpanProcessor(
        new OTLPTraceExporter({
          url: `${collectorEndpoint}/v1/traces`,
          headers,
        })
      ),
    ],
  });

  const instrumentation = new OpenAIInstrumentation();
  instrumentation.manuallyInstrument(OpenAI);

  registerInstrumentations({
    instrumentations: [instrumentation],
  });

  provider.register();
}
