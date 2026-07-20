/**
 * OpenAI SDK Quickstart - Instrumentation Setup
 *
 * Registers the Phoenix OpenTelemetry provider and manually instruments the
 * OpenAI SDK. ESM apps cannot rely on require-hook auto-instrumentation, so
 * the module is patched explicitly with manuallyInstrument.
 */

import { OpenAIInstrumentation } from "@arizeai/openinference-instrumentation-openai";
import { register } from "@arizeai/phoenix-otel";
import OpenAI from "openai";

const instrumentation = new OpenAIInstrumentation();

// Register with Phoenix - this handles all the OpenTelemetry boilerplate.
// batch: false delivers spans immediately, which is ideal for short scripts.
export const provider = register({
  projectName: "openai-quickstart",
  batch: false,
  instrumentations: [instrumentation],
});

// Manual instrumentation is required in ESM environments
instrumentation.manuallyInstrument(OpenAI);

console.log("✅ Phoenix tracing enabled for the OpenAI SDK");
console.log("   Project: openai-quickstart");
