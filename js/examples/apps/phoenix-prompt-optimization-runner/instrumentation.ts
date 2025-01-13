import "dotenv/config";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import {
  OpenAIInstrumentation,
  isPatched,
} from "@arizeai/openinference-instrumentation-openai";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { DiagConsoleLogger, DiagLogLevel, diag } from "@opentelemetry/api";
import * as OpenAI from "openai";
import { Resource } from "@opentelemetry/resources";
import { SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { SEMRESATTRS_PROJECT_NAME } from "@arizeai/openinference-semantic-conventions";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

export { isPatched };

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

const provider = new NodeTracerProvider({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: "prompt-optimization-runner",
    [SEMRESATTRS_PROJECT_NAME]: "prompt-optimization-runner",
  }),
  spanProcessors: [
    // new SimpleSpanProcessor(new ConsoleSpanExporter()),
    new SimpleSpanProcessor(
      new OTLPTraceExporter({
        url: "http://localhost:6006/v1/traces",
      })
    ),
  ],
});

provider.register();

// span exporter

const instrumentation = new OpenAIInstrumentation();
instrumentation.manuallyInstrument(OpenAI);

registerInstrumentations({
  instrumentations: [instrumentation],
});
