import { css } from "@emotion/react";

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

const trackCSS = css`
  display: flex;
  flex-direction: row;
  flex: none;
  height: var(--global-dimension-size-75);
  border-radius: 3px;
  overflow: hidden;
  background-color: var(--global-color-gray-300);
`;

const swatchCSS = css`
  display: inline-block;
  width: var(--global-dimension-size-100);
  height: var(--global-dimension-size-100);
  border-radius: 2px;
  flex: none;
`;

/**
 * How full the evaluation queue is, as one bar against its limit with a
 * section per kind of evaluation.
 */
export function EvaluationQueueMeter({
  segments,
  limit,
  width = "100px",
}: {
  segments: ReadonlyArray<EvaluationQueueMeterSegment>;
  limit: number;
  width?: string;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.count, 0);
  // A queue can briefly hold more than its limit; the bar never overflows.
  const scale = Math.max(limit, total, 1);
  // The total sits beside the bar, so the bar names only what fills it.
  const description =
    segments
      .filter((segment) => segment.count > 0)
      .map((segment) => `${segment.label} ${intFormatter(segment.count)}`)
      .join(", ") || "Empty";
  return (
    <div css={trackCSS} style={{ width }} role="img" aria-label={description}>
      {segments.map((segment) => (
        <div
          key={segment.id}
          style={{
            width: `${(segment.count / scale) * 100}%`,
            // A kind with any work queued stays visible against a large limit.
            minWidth: segment.count > 0 ? "2px" : undefined,
            backgroundColor: segment.color,
          }}
        />
      ))}
    </div>
  );
}

/** A kind of evaluation's color, naming its section of the queue meter. */
export function EvaluationQueueSwatch({ color }: { color: string }) {
  return <span css={swatchCSS} style={{ backgroundColor: color }} />;
}
