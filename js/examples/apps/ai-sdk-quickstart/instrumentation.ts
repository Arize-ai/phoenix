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

export const projectName = "ai-sdk-quickstart";

// Register with Phoenix - this handles all the OpenTelemetry boilerplate.
// batch: false delivers spans immediately, which is ideal for short scripts.
export const provider = register({
  projectName,
  batch: false,
  // Authenticates trace export when Phoenix has auth enabled. register()
  // reads PHOENIX_API_KEY on its own; it is passed explicitly here to make
  // the wiring visible.
  apiKey: process.env.PHOENIX_API_KEY,
});

// AI SDK v7 telemetry registration is process-global. headers: false only
// stops the AI SDK from recording outgoing LLM request headers as span
// attributes (they can contain authorization tokens and cookies) — it is
// unrelated to the Phoenix API key above.
registerTelemetry(
  new OpenTelemetry({
    tracer: provider.getTracer(projectName),
    headers: false,
  })
);

console.log("✅ Phoenix tracing enabled for the AI SDK");
console.log(`   Project: ${projectName}`);
