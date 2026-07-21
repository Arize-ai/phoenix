/**
 * Phoenix tracing for the Eve agent.
 *
 * Eve auto-discovers agent/instrumentation.ts and runs it once at server
 * startup, before any agent code. register() attaches a global OpenTelemetry
 * provider that Eve's built-in AI SDK telemetry picks up automatically, so
 * every turn, model call, and tool execution is traced.
 *
 * The custom span processor passed via spanProcessors replaces register()'s
 * default exporter setup so the OpenInference options below can be applied:
 * - spanFilter keeps only AI spans; Eve's workflow-engine internals would
 *   otherwise clutter the trace.
 * - reparentOrphanedSpans re-roots the AI spans left orphaned by the filter,
 *   giving each turn a single clean agent root.
 */

import {
  isOpenInferenceSpan,
  OpenInferenceSimpleSpanProcessor,
} from "@arizeai/openinference-vercel";
import { ensureCollectorEndpoint, register } from "@arizeai/phoenix-otel";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { defineInstrumentation } from "eve/instrumentation";

export default defineInstrumentation({
  setup: ({ agentName }) => {
    register({
      projectName: process.env.PHOENIX_PROJECT_NAME ?? agentName,
      spanProcessors: [
        // The simple (non-batched) processor delivers each span as it ends,
        // which is safe on the short-lived serverless functions Eve deploys to.
        new OpenInferenceSimpleSpanProcessor({
          exporter: new OTLPTraceExporter({
            url: ensureCollectorEndpoint(
              process.env.PHOENIX_COLLECTOR_ENDPOINT ?? "http://localhost:6006"
            ),
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
