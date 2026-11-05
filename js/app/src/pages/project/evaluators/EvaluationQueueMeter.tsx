import { css } from "@emotion/react";

import { SegmentChart } from "@phoenix/components/chart";
import { formatQueueCount } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

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
 * What the evaluation queue holds: a {@link SegmentChart} of the queued total,
 * with a section per kind of evaluation.
 */
export function EvaluationQueueMeter({
  segments,
}: {
  segments: ReadonlyArray<EvaluationQueueMeterSegment>;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.count, 0);
  const description =
    segments
      .filter((segment) => segment.count > 0)
      .map((segment) => `${segment.label} ${formatQueueCount(segment.count)}`)
      .join(", ") || "Empty";
  return (
    <div css={meterCSS} role="img" aria-label={description}>
      <SegmentChart
        showTrack
        totalValue={Math.max(total, 1)}
        // A kind with any work queued stays visible beside a large one.
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
