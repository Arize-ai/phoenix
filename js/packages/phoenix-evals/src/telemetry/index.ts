import { OpenTelemetry } from "@ai-sdk/otel";
import { trace, type Tracer } from "@opentelemetry/api";
import type { Telemetry } from "ai";

const DEFAULT_TRACER_NAME = "phoenix-evals";

/**
 * Returns a lazy tracer that resolves from `trace.getTracer()` on every call,
 * so evaluator spans follow whichever provider is currently mounted as global.
 *
 * Cast to `Tracer` is necessary because `startActiveSpan` has multiple
 * overload signatures that cannot be satisfied by a single implementation.
 */
export function getTracer(name: string = DEFAULT_TRACER_NAME): Tracer {
  return {
    startSpan(spanName, options, context) {
      return trace.getTracer(name).startSpan(spanName, options, context);
    },
    startActiveSpan(...args: unknown[]) {
      const tracer = trace.getTracer(name);
      return Reflect.apply(tracer.startActiveSpan, tracer, args);
    },
  } as Tracer;
}

export const tracer = getTracer();

/**
 * Builds the AI SDK telemetry integrations for an evaluator call. Per-call
 * `integrations` replace the SDK's globally registered ones, so the globals
 * (application logging, metrics, tracing to other backends) are carried
 * forward with a Phoenix tracing integration appended. If a global
 * integration already traces with the same tracer instance, the globals are
 * used as-is so the call is not traced twice.
 */
export function getTelemetryIntegrations(
  integrationTracer: Tracer
): Telemetry[] {
  const globalIntegrations = globalThis.AI_SDK_TELEMETRY_INTEGRATIONS ?? [];
  const hasTracerIntegration = globalIntegrations.some(
    // Duck-typed so integrations from a different copy of `@ai-sdk/otel`
    // are still recognized.
    (integration) =>
      "tracer" in integration && integration.tracer === integrationTracer
  );
  if (hasTracerIntegration) {
    return globalIntegrations;
  }
  return [
    ...globalIntegrations,
    new OpenTelemetry({
      tracer: integrationTracer,
      // Supplemental AI SDK attributes recommended for fuller OpenInference
      // coverage of generateObject calls.
      usage: true,
      providerMetadata: true,
      schema: true,
    }),
  ];
}
