import type { ISpanItem } from "@phoenix/components/trace/types";

type SpanFixtureOverrides = Partial<ISpanItem> & {
  id: string;
  name: string;
  spanKind: string;
  /** Relative to the trace start, so a fixture reads as a timeline. */
  startOffsetMs: number;
  /** `null` leaves the span open: no end time and no latency. */
  latencyMs: number | null;
};

/**
 * Builds a span as the trace tree holds it, with sensible defaults. Pass
 * `traceStart` to place the trace at a particular time of day.
 */
export function buildSpan(
  overrides: SpanFixtureOverrides,
  { traceStart = "2026-09-22T09:53:23.284Z" }: { traceStart?: string } = {}
): ISpanItem {
  const { startOffsetMs, latencyMs, ...rest } = overrides;
  const start = new Date(Date.parse(traceStart) + startOffsetMs);
  return {
    spanId: rest.id,
    parentId: null,
    statusCode: "OK",
    startTime: start.toISOString(),
    endTime:
      latencyMs == null
        ? null
        : new Date(start.getTime() + latencyMs).toISOString(),
    latencyMs,
    ...rest,
  };
}
