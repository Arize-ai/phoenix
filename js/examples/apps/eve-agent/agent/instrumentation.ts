/**
 * Phoenix tracing for the Eve agent.
 *
 * Eve auto-discovers agent/instrumentation.ts and runs it once at server
 * startup, before any agent code. register() attaches a global OpenTelemetry
 * provider that Eve's built-in AI SDK telemetry picks up automatically, so
 * every turn, model call, and tool execution is traced without further wiring.
 *
 * The custom span processor replaces register()'s default exporter setup:
 * - spanFilter keeps only AI spans; Eve's workflow-engine internals would
 *   otherwise clutter the trace.
 * - reparentOrphanedSpans re-roots the AI spans left orphaned by the filter,
 *   giving each turn a single clean agent root.
 */

import {
  isOpenInferenceSpan,
  OpenInferenceSimpleSpanProcessor,
} from "@arizeai/openinference-vercel";
import { OTLPTraceExporter, register } from "@arizeai/phoenix-otel";
import { defineInstrumentation } from "eve/instrumentation";

export default defineInstrumentation({
  setup: ({ agentName }) => {
    register({
      projectName: process.env.PHOENIX_PROJECT_NAME ?? agentName,
      spanProcessors: [
        // The simple (non-batched) processor delivers each span as it ends,
        // which is safe on the short-lived serverless functions Eve deploys to.
        // Swap in OpenInferenceBatchSpanProcessor if you prefer batching.
        new OpenInferenceSimpleSpanProcessor({
          exporter: new OTLPTraceExporter({
            url: `${process.env.PHOENIX_COLLECTOR_ENDPOINT ?? "http://localhost:6006"}/v1/traces`,
            // Only needed when Phoenix has auth enabled.
            headers: process.env.PHOENIX_API_KEY
              ? { Authorization: `Bearer ${process.env.PHOENIX_API_KEY}` }
              : undefined,
          }),
          spanFilter: isOpenInferenceSpan,
          reparentOrphanedSpans: true,
        }),
      ],
    });
  },
});
