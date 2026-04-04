import {
  defaultProcessInput,
  defaultProcessOutput,
  isPromise,
  OITracer,
  type AnyFn,
  type OISpan,
  type SpanTraceOptions,
} from "@arizeai/openinference-core";
import {
  SpanKind,
  SpanStatusCode,
  trace,
  type Attributes,
  type Tracer,
} from "@opentelemetry/api";

export * from "@arizeai/openinference-core";

const DEFAULT_TRACER_NAME = "openinference-core";
const OPENINFERENCE_SPAN_KIND = "openinference.span.kind";

function getOpenInferenceTracer(tracer?: Tracer): OITracer {
  if (tracer instanceof OITracer) {
    return tracer;
  }

  return new OITracer({
    tracer: tracer ?? trace.getTracer(DEFAULT_TRACER_NAME),
  });
}

function recordSpanError(span: OISpan, error: unknown): void {
  span.recordException(error as Parameters<typeof span.recordException>[0]);
  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: String(
      (error as { message?: unknown } | null | undefined)?.message ?? error
    ),
  });
}

/**
 * Phoenix-owned wrapper around `openinference-core`'s `withSpan`.
 *
 * The upstream helper resolves the global tracer when the wrapper is created.
 * Phoenix needs late binding so experiment-scoped providers and other global
 * tracer swaps are respected when the wrapped function actually runs.
 */
export function withSpan<Fn extends AnyFn = AnyFn>(
  fn: Fn,
  options?: SpanTraceOptions<Fn>
): Fn {
  const {
    tracer: customTracer,
    name: optionsName,
    openTelemetrySpanKind = SpanKind.INTERNAL,
    kind = "CHAIN",
    attributes: baseAttributes,
  } = options ?? {};
  const processInput: (...args: Parameters<Fn>) => Attributes =
    options?.processInput ??
    ((...args: Parameters<Fn>) => defaultProcessInput(...args));
  const processOutput: (result: Awaited<ReturnType<Fn>>) => Attributes =
    options?.processOutput ??
    ((result: Awaited<ReturnType<Fn>>) => defaultProcessOutput(result));
  const spanName = optionsName || fn.name;
  const wrappedFn: Fn = function (
    this: ThisParameterType<Fn>,
    ...args: Parameters<Fn>
  ) {
    const tracer = getOpenInferenceTracer(customTracer);

    return tracer.startActiveSpan(
      spanName,
      {
        kind: openTelemetrySpanKind,
        attributes: {
          ...baseAttributes,
          [OPENINFERENCE_SPAN_KIND]: kind,
          ...processInput(...args),
        },
      },
      (span) => {
        try {
          const result = fn.apply(this, args) as ReturnType<Fn>;

          if (isPromise(result)) {
            return result
              .then((value: Awaited<ReturnType<Fn>>) => {
                span.setAttributes(processOutput(value));
                span.setStatus({
                  code: SpanStatusCode.OK,
                });
                return value;
              })
              .catch((error: unknown) => {
                recordSpanError(span, error);
                throw error;
              })
              .finally(() => span.end());
          }

          span.setAttributes(processOutput(result as Awaited<ReturnType<Fn>>));
          span.setStatus({
            code: SpanStatusCode.OK,
          });
          span.end();

          return result;
        } catch (error) {
          recordSpanError(span, error);
          span.end();
          throw error;
        }
      }
    );
  } as Fn;

  return wrappedFn;
}

export function traceChain<Fn extends AnyFn>(
  fn: Fn,
  options?: Omit<SpanTraceOptions<Fn>, "kind">
): Fn {
  return withSpan<Fn>(fn, {
    ...options,
    kind: "CHAIN",
  });
}

export function traceAgent<Fn extends AnyFn>(
  fn: Fn,
  options?: Omit<SpanTraceOptions<Fn>, "kind">
): Fn {
  return withSpan<Fn>(fn, {
    ...options,
    kind: "AGENT",
  });
}

export function traceTool<Fn extends AnyFn>(
  fn: Fn,
  options?: Omit<SpanTraceOptions<Fn>, "kind">
): Fn {
  return withSpan<Fn>(fn, {
    ...options,
    kind: "TOOL",
  });
}

export function observe<Fn extends AnyFn>(options: SpanTraceOptions<Fn> = {}) {
  return function (originalMethod: Fn, context: ClassMethodDecoratorContext) {
    const methodName = String(context.name);
    const traceOptions: SpanTraceOptions<Fn> = {
      ...options,
      name: options.name || methodName,
    };

    return function (this: ThisParameterType<Fn>, ...args: Parameters<Fn>) {
      const boundMethod = originalMethod.bind(this) as Fn;
      const tracedMethod = withSpan(boundMethod, traceOptions);

      return tracedMethod(...args);
    } as Fn;
  };
}
