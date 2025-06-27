import { css } from "@emotion/react";

import { getChartColor, useChartColors } from "./colors";

const chartContainerCSS = css`
  width: 100%;
  display: flex;
  flex-direction: row;
  overflow: hidden;
  border-radius: 8px;
  gap: 2px;
`;

const chartSegmentCSS = css`
  height: 100%;
  flex-shrink: 0;
  flex-grow: 0;
`;

export type SegmentChartProps = {
  /**
   * The height of the chart in pixels.
   * @default 6
   */
  height?: number;
  /**
   * The total value of the chart
   */
  totalValue?: number;
  /**
   * The segments to display in the chart
   */
  segments: {
    /**
     * The name of the segment
     */
    name: string;
    /**
     * The value of the segment
     */
    value: number;
    /**
     * Optional color override for the segment
     */
    color?: string;
  }[];
};

export const SegmentChart = ({
  height = 6,
  segments,
  totalValue: _totalValue,
}: SegmentChartProps) => {
  const colors = useChartColors();
  // if the total value is not provided, we calculate it from the segments
  // this is useful for cases where the total value is not known ahead of time
  const totalValue =
    _totalValue ?? segments.reduce((acc, segment) => acc + segment.value, 0);

  return (
    <div style={{ height: `${height}px` }} css={chartContainerCSS}>
      {segments.map((segment, index) => {
        const percentage =
          totalValue > 0 ? (segment.value / totalValue) * 100 : 0;
        const color = segment.color || getChartColor(index, colors);
        return (
          <div
            key={segment.name}
            css={chartSegmentCSS}
            style={{
              width: `${percentage}%`,
              backgroundColor: color,
            }}
          />
        );
      })}
    </div>
  );
};
