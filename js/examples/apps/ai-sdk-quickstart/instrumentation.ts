/**
 * Registers Phoenix tracing for the Vercel AI SDK. Import this file before
 * making any AI SDK calls; every call after that is traced.
 */

import { OpenTelemetry } from "@ai-sdk/otel";
import { register } from "@arizeai/phoenix-otel";
import { registerTelemetry } from "ai";

// Handles all the OpenTelemetry setup and exports spans to Phoenix.
// Reads PHOENIX_COLLECTOR_ENDPOINT and PHOENIX_API_KEY from the environment.
export const provider = register({
  projectName: "ai-sdk-quickstart",
});

// Point the AI SDK's telemetry at OpenTelemetry. headers: false keeps
// outgoing LLM request headers (which can contain credentials) off of spans.
registerTelemetry(new OpenTelemetry({ headers: false }));
