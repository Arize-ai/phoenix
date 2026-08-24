/**
 * Registers Phoenix tracing for the Vercel AI SDK. Import this file before
 * making any AI SDK calls. Every call after that is traced.
 */

import { OpenTelemetry } from "@ai-sdk/otel";
import { register } from "@arizeai/phoenix-otel";
import { registerTelemetry } from "ai";

export const projectName = "brittany-smart-agent";

// Handles the OpenTelemetry setup and exports spans to Phoenix.
// Reads PHOENIX_COLLECTOR_ENDPOINT and PHOENIX_API_KEY from the environment.
export const provider = register({
  projectName,
});

// headers: false keeps the outgoing request headers out of the spans, because
// they carry your API key.
registerTelemetry(new OpenTelemetry({ headers: false }));
