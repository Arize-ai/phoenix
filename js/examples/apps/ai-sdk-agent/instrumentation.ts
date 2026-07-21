/**
 * Registers the Phoenix OpenTelemetry provider and wires it into the AI SDK's
 * process-global telemetry registry. Import this file before making any AI SDK
 * calls; every call after that is traced.
 */

import { OpenTelemetry } from "@ai-sdk/otel";
import { register } from "@arizeai/phoenix-otel";
import { registerTelemetry } from "ai";

export const projectName = "ai-sdk-agent";

// Register with Phoenix - this handles all the OpenTelemetry boilerplate and
// attaches the provider as the process-global tracer provider. register()
// reads PHOENIX_COLLECTOR_ENDPOINT and PHOENIX_API_KEY from the environment.
// batch: false delivers spans immediately, which is ideal for short scripts.
export const provider = register({
  projectName,
  batch: false,
});

// AI SDK v7 telemetry registration is process-global; the AI SDK picks up the
// global tracer provider registered above. headers: false stops the AI SDK
// from recording outgoing LLM request headers as span attributes (they can
// contain authorization tokens and cookies).
registerTelemetry(new OpenTelemetry({ headers: false }));

console.log("✅ Phoenix tracing enabled for the AI SDK");
console.log(`   Project: ${projectName}`);
