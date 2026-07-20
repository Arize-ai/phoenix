/**
 * AI SDK v7 Quickstart - Instrumentation Setup
 *
 * Registers the Phoenix OpenTelemetry provider and wires it into the AI SDK's
 * process-global telemetry registry. Import this file before making any AI SDK
 * calls.
 */

import { OpenTelemetry } from "@ai-sdk/otel";
import { register } from "@arizeai/phoenix-otel";
import { registerTelemetry } from "ai";

// Register with Phoenix - this handles all the OpenTelemetry boilerplate.
// batch: false delivers spans immediately, which is ideal for short scripts.
export const provider = register({
  projectName: "ai-sdk-quickstart",
  batch: false,
});

// AI SDK v7 telemetry registration is process-global. Request-header capture
// is disabled because headers can contain authorization tokens and cookies.
registerTelemetry(
  new OpenTelemetry({
    tracer: provider.getTracer("ai-sdk-quickstart"),
    headers: false,
  })
);

console.log("✅ Phoenix tracing enabled for the AI SDK");
console.log("   Project: ai-sdk-quickstart");
