/**
 * Phoenix Tracing Instrumentation Setup
 *
 * This file configures OpenTelemetry to send traces to Phoenix.
 * Import this file at the top of your application to enable tracing.
 */

import { register } from "@arizeai/phoenix-otel";

// Set OpenTelemetry attribute value length limit BEFORE any imports
// This must be set before OpenTelemetry initializes to prevent truncation
if (!process.env.OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT) {
  process.env.OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT = "25000";
}

// Register with Phoenix - this handles all the OpenTelemetry boilerplate
export const provider = register({
  projectName: process.env.PHOENIX_PROJECT_NAME || "langchain-ts-quickstart",
  // Optional: set batch to false for immediate span delivery during development
  batch: false,
});

console.log("✅ Phoenix tracing enabled");
console.log(`   Project: ${process.env.PHOENIX_PROJECT_NAME || "langchain-ts-quickstart"}`);
console.log("");

