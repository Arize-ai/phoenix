import { css } from "@emotion/react";

import { SegmentChart } from "@phoenix/components/chart";
import { intFormatter } from "@phoenix/utils/numberFormatUtils";

export type EvaluationQueueMeterSegment = {
  /** Stable key, e.g. the evaluation target. */
  id: string;
  /** The kind of evaluation, e.g. "Spans". */
  label: string;
  count: number;
  /** A CSS color, e.g. a categorical chart color. */
  color: string;
};

const meterCSS = css`
  width: 100%;
  --segment-chart-height: var(--global-dimension-size-75);
`;

const swatchCSS = css`
  display: inline-block;
  width: var(--global-dimension-size-100);
  height: var(--global-dimension-size-100);
  border-radius: 2px;
  flex: none;
`;

/**
 * How full the evaluation queue is: a {@link SegmentChart} against the queue's
 * limit, with a section per kind of evaluation and a track for the room left.
 */
export function EvaluationQueueMeter({
  segments,
  limit,
}: {
  segments: ReadonlyArray<EvaluationQueueMeterSegment>;
  limit: number;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.count, 0);
  // A queue can briefly hold more than its limit; the bar never overflows.
  const scale = Math.max(limit, total, 1);
  const description =
    segments
      .filter((segment) => segment.count > 0)
      .map((segment) => `${segment.label} ${intFormatter(segment.count)}`)
      .join(", ") || "Empty";
  return (
    <div
      css={meterCSS}
      role="img"
      aria-label={`${intFormatter(total)} of ${intFormatter(limit)}: ${description}`}
    >
      <SegmentChart
        showTrack
        totalValue={scale}
        // A kind with any work queued stays visible against a large limit.
        minimumSegmentPercentage={1.5}
        segments={segments.map((segment) => ({
          name: segment.id,
          value: segment.count,
          color: segment.color,
        }))}
      />
    </div>
  );
}

/** A kind of evaluation's color, naming its section of the queue meter. */
export function EvaluationQueueSwatch({ color }: { color: string }) {
  return <span css={swatchCSS} style={{ backgroundColor: color }} />;
}
