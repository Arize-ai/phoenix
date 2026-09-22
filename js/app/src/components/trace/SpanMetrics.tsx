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
import { hasSpanMetrics, SpanMetricsRow } from "./SpanMetricsRow";

export type SpanMetricsProps = SpanMetricsRowProps & {
  /** The node id of the span whose details the tooltip loads. */
  spanNodeId: string;
};

/**
 * A span's latency · tokens · cost with one tooltip over the whole row that
 * lazily loads the full latency, token and cost breakdown.
 *
 * @remarks
 * The same component draws the span header's metrics and every trace tree
 * row's footer. Renders nothing for a span with no metrics, so callers need
 * not check first.
 */
export function SpanMetrics({ spanNodeId, ...rowProps }: SpanMetricsProps) {
  if (!hasSpanMetrics(rowProps)) {
    return null;
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
