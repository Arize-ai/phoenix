import { trace, type Tracer } from "@opentelemetry/api";

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
