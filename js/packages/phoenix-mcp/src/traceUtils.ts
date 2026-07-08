import type { componentsV1 } from "@arizeai/phoenix-client";

export type Span = componentsV1["schemas"]["Span"];
export type SpanAnnotation = componentsV1["schemas"]["SpanAnnotation"];
export type SpanWithAnnotations = Span & { annotations?: SpanAnnotation[] };

/**
 * Summary view of a trace built from its constituent spans.
 */
export interface Trace {
  /** The trace ID shared by all spans in this trace. */
  traceId: string;
  /** All spans belonging to this trace. */
  spans: SpanWithAnnotations[];
  /** The root span (no parent), if one exists. */
  rootSpan?: SpanWithAnnotations;
  /** Earliest span start time (ISO 8601). */
  startTime?: string;
  /** Latest span end time (ISO 8601). */
  endTime?: string;
  /** Wall-clock duration of the trace in milliseconds. */
  duration?: number;
  /** `"ERROR"` if any span has an error status or error attribute; `"OK"` otherwise. */
  status?: string;
}

/**
 * Group an array of spans by their `trace_id`, returning a map
 * from trace ID to the spans belonging to that trace.
 */
export function groupSpansByTrace({
  spans,
}: {
  spans: SpanWithAnnotations[];
}): Map<string, SpanWithAnnotations[]> {
  const traces = new Map<string, SpanWithAnnotations[]>();

  for (const span of spans) {
    const traceId = span.context.trace_id;
    if (!traces.has(traceId)) {
      traces.set(traceId, []);
    }
    traces.get(traceId)!.push(span);
  }

  return traces;
}

/**
 * Build a {@link Trace} summary from a non-empty array of spans that share
 * the same trace ID.
 *
 * The summary includes the root span, overall time range, duration, and a
 * roll-up status that is `"ERROR"` when any span has an error.
 *
 * @throws When the spans array is empty.
 */
export function buildTrace({ spans }: { spans: SpanWithAnnotations[] }): Trace {
  if (spans.length === 0) {
    throw new Error("Cannot build trace from empty spans array");
  }

  const traceId = spans[0]!.context.trace_id;
  const rootSpan = spans.find((span) => !span.parent_id);
  const startTimes = spans
    .map((span) => new Date(span.start_time).getTime())
    .filter((time) => !Number.isNaN(time));
  const endTimes = spans
    .map((span) => new Date(span.end_time).getTime())
    .filter((time) => !Number.isNaN(time));

  const startTime =
    startTimes.length > 0
      ? new Date(Math.min(...startTimes)).toISOString()
      : undefined;
  const endTime =
    endTimes.length > 0
      ? new Date(Math.max(...endTimes)).toISOString()
      : undefined;
  const duration =
    startTime && endTime
      ? new Date(endTime).getTime() - new Date(startTime).getTime()
      : undefined;
  const hasErrors = spans.some(
    (span) =>
      span.status_code === "ERROR" ||
      (span.attributes as { error?: unknown } | undefined)?.error
  );

  return {
    traceId,
    spans,
    rootSpan,
    startTime,
    endTime,
    duration,
    status: hasErrors ? "ERROR" : "OK",
  };
}
