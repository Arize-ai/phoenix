import { OpenInferenceSimpleSpanProcessor } from "@arizeai/openinference-vercel";
import { OTLPTraceExporter, register } from "@arizeai/phoenix-otel";

// Non-batching processor: spans export as they end, so no shutdown is needed.
register({
  projectName: "simple-processor",
  spanProcessors: [
    new OpenInferenceSimpleSpanProcessor({ exporter: new OTLPTraceExporter() }),
  ],
});
