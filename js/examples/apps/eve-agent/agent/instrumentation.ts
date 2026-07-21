/**
 * Phoenix tracing for the Eve agent.
 *
 * Eve auto-discovers agent/instrumentation.ts and runs it once at server
 * startup, before any agent code. register() attaches a global OpenTelemetry
 * provider with Phoenix's OpenInference span processor; Eve's built-in AI SDK
 * telemetry picks it up from the global registry, so every turn, model call,
 * and tool execution is traced without further wiring.
 */

import { isOpenInferenceSpan } from "@arizeai/openinference-vercel";
import { register } from "@arizeai/phoenix-otel";
import { defineInstrumentation } from "eve/instrumentation";

export default defineInstrumentation({
  setup: ({ agentName }) => {
    // register() reads PHOENIX_COLLECTOR_ENDPOINT and PHOENIX_API_KEY from the
    // environment and defaults to http://localhost:6006.
    register({
      projectName: process.env.PHOENIX_PROJECT_NAME ?? agentName,
      // Simple (non-batched) export delivers each span as it ends, which is
      // safe on the short-lived serverless functions Eve deploys to.
      batch: false,
      // Keep only AI spans; Eve's workflow-engine internals would otherwise
      // clutter the trace. Re-rooting the spans left orphaned by the filter
      // gives each turn a single clean agent root.
      spanFilter: isOpenInferenceSpan,
      reparentOrphanedSpans: true,
    });
  },
});
