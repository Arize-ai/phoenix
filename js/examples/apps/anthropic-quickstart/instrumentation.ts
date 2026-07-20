/**
 * Anthropic SDK Quickstart - Instrumentation Setup
 *
 * Registers the Phoenix OpenTelemetry provider and manually instruments the
 * Anthropic SDK. ESM apps cannot rely on require-hook auto-instrumentation,
 * so the module is patched explicitly with manuallyInstrument.
 */

import Anthropic from "@anthropic-ai/sdk";
import { AnthropicInstrumentation } from "@arizeai/openinference-instrumentation-anthropic";
import { register } from "@arizeai/phoenix-otel";

const instrumentation = new AnthropicInstrumentation();

// Register with Phoenix - this handles all the OpenTelemetry boilerplate.
// batch: false delivers spans immediately, which is ideal for short scripts.
export const provider = register({
  projectName: "anthropic-quickstart",
  batch: false,
  instrumentations: [instrumentation],
});

// Manual instrumentation is required in ESM environments
instrumentation.manuallyInstrument(Anthropic);

console.log("✅ Phoenix tracing enabled for the Anthropic SDK");
console.log("   Project: anthropic-quickstart");
