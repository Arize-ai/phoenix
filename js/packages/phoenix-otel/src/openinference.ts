import {
  defaultProcessInput,
  defaultProcessOutput,
  isPromise,
  OITracer,
  type AnyFn,
  type OISpan,
  type SpanTraceOptions,
} from "@arizeai/openinference-core";
import { SemanticConventions } from "@arizeai/openinference-semantic-conventions";
import {
  SpanKind,
  SpanStatusCode,
  trace,
  type Attributes,
  type Tracer,
} from "@opentelemetry/api";

export * from "@arizeai/openinference-core";

const DEFAULT_TRACER_NAME = "phoenix-otel";

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
 * Wraps a function so that each invocation is automatically traced as an
 * OpenInference span.
 *
 *
 * @param fn - The function to wrap with tracing.
 * @param options - Span configuration including name, kind, attributes, and input/output processors.
 * @returns A new function with the same signature as `fn` that creates and manages a trace span on each invocation.
 *
 * @example
 * ```typescript
 * const tracedFn = withSpan(
 *   async (query: string) => `processed: ${query}`,
 *   { name: "my-function", kind: "CHAIN" }
 * );
 * await tracedFn("hello");
 * ```
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
          [SemanticConventions.OPENINFERENCE_SPAN_KIND]: kind,
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

/**
 * Wraps a function so each invocation is traced as a CHAIN span.
 *
 * Convenience wrapper around {@link withSpan} with `kind` preset to `"CHAIN"`.
 * Use for pipeline steps, orchestration logic, or any general-purpose traced function.
 *
 * @param fn - The function to wrap with tracing.
 * @param options - Span configuration (name, attributes, input/output processors). `kind` is preset and cannot be overridden.
 * @returns A new function with the same signature that creates a CHAIN span on each invocation.
 *
 * @example
 * ```typescript
 * const summarize = traceChain(
 *   async (text: string) => `Summary of ${text.length} chars`,
 *   { name: "summarize" }
 * );
 * await summarize("Hello world");
 * ```
 */
export function traceChain<Fn extends AnyFn>(
  fn: Fn,
  options?: Omit<SpanTraceOptions<Fn>, "kind">
): Fn {
  return withSpan<Fn>(fn, {
    ...options,
    kind: "CHAIN",
  });
}

/**
 * Wraps a function so each invocation is traced as an AGENT span.
 *
 * Convenience wrapper around {@link withSpan} with `kind` preset to `"AGENT"`.
 * Use for autonomous agent entry points and decision-making components.
 *
 * @param fn - The function to wrap with tracing.
 * @param options - Span configuration (name, attributes, input/output processors). `kind` is preset and cannot be overridden.
 * @returns A new function with the same signature that creates an AGENT span on each invocation.
 *
 * @example
 * ```typescript
 * const supportAgent = traceAgent(
 *   async (question: string) => ({ answer: "Here's how to reset your password..." }),
 *   { name: "support-agent" }
 * );
 * await supportAgent("How do I reset my password?");
 * ```
 */
export function traceAgent<Fn extends AnyFn>(
  fn: Fn,
  options?: Omit<SpanTraceOptions<Fn>, "kind">
): Fn {
  return withSpan<Fn>(fn, {
    ...options,
    kind: "AGENT",
  });
}

/**
 * Wraps a function so each invocation is traced as a TOOL span.
 *
 * Convenience wrapper around {@link withSpan} with `kind` preset to `"TOOL"`.
 * Use for tool calls, API lookups, and function-calling targets.
 *
 * @param fn - The function to wrap with tracing.
 * @param options - Span configuration (name, attributes, input/output processors). `kind` is preset and cannot be overridden.
 * @returns A new function with the same signature that creates a TOOL span on each invocation.
 *
 * @example
 * ```typescript
 * const searchDocs = traceTool(
 *   async (query: string) => fetch(`/api/search?q=${query}`).then(r => r.json()),
 *   { name: "search-docs" }
 * );
 * await searchDocs("OpenTelemetry");
 * ```
 */
export function traceTool<Fn extends AnyFn>(
  fn: Fn,
  options?: Omit<SpanTraceOptions<Fn>, "kind">
): Fn {
  return withSpan<Fn>(fn, {
    ...options,
    kind: "TOOL",
  });
}

/**
 * Returns a TC39 stage-3 class method decorator that traces the decorated method
 * as an OpenInference span.
 *
 * Uses {@link withSpan} under the hood, so the tracer is resolved at call time.
 * The method name is used as the default span name; pass `name` in options to override.
 *
 * @param options - Span configuration (kind, name, attributes, input/output processors).
 * @returns A class method decorator function.
 *
 * @example
 * ```typescript
 * class SupportBot {
 *   @observe({ kind: "AGENT" })
 *   async handleTicket(ticketId: string) {
 *     return { resolved: true };
 *   }
 * }
 * ```
 */
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
