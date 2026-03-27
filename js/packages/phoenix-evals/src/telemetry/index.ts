import { trace, type Tracer } from "@opentelemetry/api";

const DEFAULT_TRACER_NAME = "phoenix-evals";

export function getTracer(name: string = DEFAULT_TRACER_NAME): Tracer {
  return {
    startSpan(spanName, options, context) {
      return trace.getTracer(name).startSpan(spanName, options, context);
    },
    startActiveSpan(_spanName, _options, _context, _fn) {
      const tracer = trace.getTracer(name);

      return Reflect.apply(tracer.startActiveSpan, tracer, arguments);
    },
  } as Tracer;
}

export const tracer = getTracer();
