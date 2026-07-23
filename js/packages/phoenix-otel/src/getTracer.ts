import { trace, type Tracer } from "@opentelemetry/api";

/**
 * Returns a tracer that resolves from the global tracer provider on every
 * call, so spans always follow the provider that is currently mounted.
 *
 * A tracer obtained directly via `trace.getTracer()` binds to the global
 * registration that exists when it is created; after
 * {@link attachGlobalTracerProvider} or {@link detachGlobalTracerProvider}
 * swap the global provider, that tracer keeps pointing at the old
 * registration and silently drops spans. Use this whenever a tracer is
 * created ahead of time and must survive provider swaps — for example when
 * registering an AI SDK telemetry integration at startup while experiments
 * mount their own provider per run.
 *
 * The cast to `Tracer` is necessary because `startActiveSpan` has multiple
 * overload signatures that cannot be satisfied by a single implementation.
 */
export function getTracer(name: string): Tracer {
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
