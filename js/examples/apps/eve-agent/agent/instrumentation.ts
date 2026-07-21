/**
 * Phoenix tracing for the Eve agent.
 *
 * Eve auto-discovers agent/instrumentation.ts and runs it once at server
 * startup, before any agent code. register() attaches a global OpenTelemetry
 * provider that Eve's built-in AI SDK telemetry picks up automatically, so
 * every turn, model call, and tool execution is traced without further wiring.
 *
 * register() reads PHOENIX_COLLECTOR_ENDPOINT and PHOENIX_API_KEY from the
 * environment and defaults to http://localhost:6006.
 */

import { register } from "@arizeai/phoenix-otel";
import { defineInstrumentation } from "eve/instrumentation";

export default defineInstrumentation({
  setup: ({ agentName }) => {
    register({
      projectName: process.env.PHOENIX_PROJECT_NAME ?? agentName,
      // Simple (non-batched) export delivers each span as it ends, which is
      // safe on the short-lived serverless functions Eve deploys to.
      batch: false,
    });
  },
});
