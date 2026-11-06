import { OpenTelemetry } from "@ai-sdk/otel";
import type { Tracer } from "@opentelemetry/api";
import { trace } from "@opentelemetry/api";
import type { Telemetry } from "ai";
import { registerTelemetry } from "ai";

const TRACER_NAME = "ai-query-evals";

/**
 * The tracer behind the AI SDK telemetry integration, resolved from
 * `trace.getTracer()` on every call rather than captured once at module
 * load: this module loads before the Phoenix test runner mounts its
 * provider, and a tracer captured that early binds to a provider that
 * never receives the delegate — silently dropping every span. Lazy lookup
 * follows whichever provider is mounted (and no-ops on dry runs). Shared
 * with the phoenix-evals judge so its calls are traced exactly once —
 * phoenix-evals skips appending its own integration when a global one
 * already carries this tracer instance.
 */
export const evalTracer: Tracer = {
  startSpan(name, options, context) {
    return trace.getTracer(TRACER_NAME).startSpan(name, options, context);
  },
  startActiveSpan(...args: unknown[]) {
    const tracer = trace.getTracer(TRACER_NAME);
    return Reflect.apply(tracer.startActiveSpan.bind(tracer), tracer, args);
  },
  // startActiveSpan's overloads cannot be satisfied by one implementation.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
} as Tracer;

declare global {
  // `var` is what ambient globalThis augmentation requires.
  // eslint-disable-next-line no-var
  var __aiQueryEvalsTelemetryRegistered: boolean | undefined;
}

if (!globalThis.__aiQueryEvalsTelemetryRegistered) {
  globalThis.__aiQueryEvalsTelemetryRegistered = true;
  // Makes every AI SDK call in the eval suites (generation and judge alike)
  // emit spans; the runner's span processor converts them to OpenInference
  // and parents them under each test's task span.
  registerTelemetry(
    // @ai-sdk/otel compiles against a slightly newer `ai` than the app's,
    // so its structurally equivalent Telemetry type doesn't unify with
    // ours. Runtime compatibility is the same contract phoenix-evals
    // relies on when it registers this integration itself.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    new OpenTelemetry({
      tracer: evalTracer,
      usage: true,
      providerMetadata: true,
      schema: true,
    }) as unknown as Telemetry
  );
}
