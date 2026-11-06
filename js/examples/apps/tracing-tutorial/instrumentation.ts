/**
 * Phoenix Tracing Tutorial - Instrumentation Setup
 *
 * This file configures OpenTelemetry to send traces to Phoenix.
 * Import this file at the top of each tutorial script to enable tracing.
 */

import { register } from "@arizeai/phoenix-otel";

// Register with Phoenix - this handles all the OpenTelemetry boilerplate
export const provider = register({
  projectName: "support-bot",
  // Optional: set batch to false for immediate span delivery during development
  batch: false,
});

console.log("✅ Phoenix tracing enabled");
console.log(`   Project: support-bot`);
console.log("");
