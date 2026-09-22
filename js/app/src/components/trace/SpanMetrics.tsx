import { Suspense } from "react";
import { Focusable } from "react-aria";

import {
  Loading,
  RichTooltip,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components";

import { SpanMetricsDetailsById } from "./SpanMetricsDetails";
import type { SpanMetricsRowProps } from "./SpanMetricsRow";
import {
  hasSpanMetrics,
  hasSpanMetricsDetails,
  SpanMetricsRow,
} from "./SpanMetricsRow";

export type SpanMetricsProps = SpanMetricsRowProps & {
  /** The node id of the span whose details the tooltip loads. */
  spanNodeId: string;
};

/**
 * A span's latency · tokens · cost with one tooltip over the whole row that
 * lazily loads the token and cost breakdown. A span with latency alone gets
 * the bare row, since there is nothing more to show.
 *
 * @remarks
 * For a surface that shows one span at a time, such as the span header. The
 * trace tree draws the bare `SpanMetricsRow` under each row instead and
 * shares one preview popover across every row (`TraceTreeSpanPreview`).
 * Renders nothing for a span with no metrics, so callers need not check
 * first.
 */
export function SpanMetrics({ spanNodeId, ...rowProps }: SpanMetricsProps) {
  if (!hasSpanMetrics(rowProps)) {
    return null;
  }
  if (!hasSpanMetricsDetails(rowProps)) {
    return <SpanMetricsRow {...rowProps} />;
  }
  return (
    <TooltipTrigger>
      <Focusable>
        <SpanMetricsRow {...rowProps} aria-label="Span metrics" />
      </Focusable>
      <RichTooltip placement="bottom start">
        <TooltipArrow />
        <Suspense fallback={<Loading />}>
          <SpanMetricsDetailsById spanNodeId={spanNodeId} />
        </Suspense>
      </RichTooltip>
    </TooltipTrigger>
  );
}
