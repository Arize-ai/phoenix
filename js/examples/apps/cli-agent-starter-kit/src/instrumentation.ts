/**
 * Phoenix OpenTelemetry instrumentation setup
 * This file must be imported before any other application code
 * to ensure tracing is properly initialized.
 */
import { register } from "@arizeai/phoenix-otel";

// Register Phoenix tracing with configuration from environment variables
// or defaults to local Phoenix server at http://localhost:6006
register({
  projectName: "cli-agent-starter-kit",
  // batch: true is recommended for production, false for development
  batch: true,
});

console.log("Phoenix tracing initialized");
