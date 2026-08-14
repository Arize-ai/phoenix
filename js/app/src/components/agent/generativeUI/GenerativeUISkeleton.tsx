import { css } from "@emotion/react";

import { Skeleton } from "@phoenix/components/core/loading";

/**
 * Matches ChartFrame styling for visual consistency
 */
const frameCSS = css`
  border: 1px solid var(--global-color-gray-200);
  border-radius: var(--global-rounding-medium);
  padding: var(--global-dimension-size-150);
  background: var(--global-color-gray-75);
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
`;

const titleCSS = css`
  margin-bottom: var(--global-dimension-size-150);
`;

/**
 * Chart area with vertical bars rising from a baseline
 */
const chartAreaCSS = css`
  display: flex;
  align-items: flex-end;
  gap: var(--global-dimension-size-100);
  height: var(--global-dimension-size-1125);
`;

const barWrapperCSS = css`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: flex-end;
`;

const axisCSS = css`
  display: flex;
  justify-content: space-between;
  margin-top: var(--global-dimension-size-100);
`;

/**
 * Chart height matches VerticalBarChart and LineChart
 */
const CHART_HEIGHT = 90;

/**
 * Bar heights as pixels to create a realistic chart silhouette
 */
const BAR_HEIGHTS = [
  Math.round(CHART_HEIGHT * 0.65),
  Math.round(CHART_HEIGHT * 0.85),
  Math.round(CHART_HEIGHT * 0.45),
  Math.round(CHART_HEIGHT * 0.7),
  Math.round(CHART_HEIGHT * 0.55),
  Math.round(CHART_HEIGHT * 0.9),
  Math.round(CHART_HEIGHT * 0.4),
  Math.round(CHART_HEIGHT * 0.75),
  Math.round(CHART_HEIGHT * 0.6),
  Math.round(CHART_HEIGHT * 0.5),
];

export function GenerativeUISkeleton() {
  return (
    <div css={frameCSS} aria-label="Loading generative UI">
      <div css={titleCSS}>
        <Skeleton width={120} height={12} animation="wave" />
      </div>
      <div css={chartAreaCSS}>
        {BAR_HEIGHTS.map((height, index) => (
          <div key={index} css={barWrapperCSS}>
            <Skeleton
              width="100%"
              height={height}
              borderRadius="S"
              animation="wave"
            />
          </div>
        ))}
      </div>
      <div css={axisCSS}>
        <Skeleton width={24} height={8} animation="wave" />
        <Skeleton width={24} height={8} animation="wave" />
      </div>
    </div>
  );
}
