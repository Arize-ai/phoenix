import type { componentsV1 } from "@arizeai/phoenix-client";

export type Span = componentsV1["schemas"]["Span"];
export type SpanAnnotation = componentsV1["schemas"]["SpanAnnotation"];
export type SpanWithAnnotations = Span & { annotations?: SpanAnnotation[] };

/**
 * Represents a trace with its spans organized hierarchically
 */
export interface Trace {
  traceId: string;
  spans: SpanWithAnnotations[];
  rootSpan?: SpanWithAnnotations;
  startTime?: string;
  endTime?: string;
  duration?: number;
  status?: string;
}

/**
 * Group spans by trace ID
 */
export interface GroupSpansByTraceOptions {
  /**
   * Spans to group.
   */
  spans: SpanWithAnnotations[];
}

/**
 * Group spans by trace ID.
 */
export function groupSpansByTrace({
  spans,
}: GroupSpansByTraceOptions): Map<string, SpanWithAnnotations[]> {
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
 * Build a trace object from spans
 */
export interface BuildTraceOptions {
  /**
   * Spans belonging to a single trace.
   */
  spans: SpanWithAnnotations[];
}

/**
 * Build a trace object from spans.
 */
export function buildTrace({ spans }: BuildTraceOptions): Trace {
  if (spans.length === 0) {
    throw new Error("Cannot build trace from empty spans array");
  }

  const traceId = spans[0]!.context.trace_id;

  // Find root span (no parent)
  const rootSpan = spans.find((s) => !s.parent_id);

  // Calculate trace timing
  const startTimes = spans
    .map((s) => new Date(s.start_time).getTime())
    .filter((t) => !isNaN(t));
  const endTimes = spans
    .map((s) => new Date(s.end_time).getTime())
    .filter((t) => !isNaN(t));

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

  // Determine status
  const hasErrors = spans.some(
    (s) =>
      s.status_code === "ERROR" ||
      (s.attributes as { error?: unknown } | undefined)?.error
  );
  const status = hasErrors ? "ERROR" : "OK";

  return {
    traceId,
    spans,
    rootSpan,
    startTime,
    endTime,
    duration,
    status,
  };
}
