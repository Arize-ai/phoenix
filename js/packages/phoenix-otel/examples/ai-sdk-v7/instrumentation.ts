import { OpenTelemetry } from "@ai-sdk/otel";
import { register } from "@arizeai/phoenix-otel";
import { registerTelemetry } from "ai";

// Register the Phoenix provider. This wires up the OpenInference span
// processors that translate AI SDK v7 spans for Phoenix.
export const provider = register({
  projectName: "ai-sdk-v7-example",
});

// AI SDK v7 telemetry is process-global; register the integration once at
// startup. Header capture is disabled because request headers can contain
// authorization tokens and cookies.
registerTelemetry(
  new OpenTelemetry({
    tracer: provider.getTracer("@arizeai/phoenix-otel/ai-sdk"),
    headers: false,
  })
);
