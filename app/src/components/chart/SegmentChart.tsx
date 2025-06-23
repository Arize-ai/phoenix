import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from "recharts";

import { getChartColor, useChartColors } from "./colors";

const DEFAULT_RADIUS: [number, number, number, number] = [8, 8, 8, 8];

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
  // Transform the segments into a format that recharts can use
  const data = [
    segments.reduce(
      (acc, segment) => {
        acc[segment.name] = segment.value / totalValue;
        return acc;
      },
      {} as Record<string, number>
    ),
  ];
  // map the segment names to their colors
  const colorByNameMap = segments.reduce(
    (acc, segment, index) => {
      acc[segment.name] = segment.color || getChartColor(index, colors);
      return acc;
    },
    {} as Record<string, string>
  );

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          style={{ display: "flex" }}
          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
          data={data}
          barSize="100%"
          layout="vertical"
        >
          {/* recharts has a weird bug where you can not render a vertical bar chart without x and y axes */}
          {/* so we hide them and use the dataKey to set the x and y axes */}
          <XAxis type="number" hide />
          <YAxis type="category" hide />
          {Object.keys(data[0]).map((name, index, arr) => {
            const first = index === 0;
            const last = index === arr.length - 1;
            // round the corners of terminal bars, but not the center bars
            const radius: [number, number, number, number] = first
              ? [8, 0, 0, 8]
              : last
                ? [0, 8, 8, 0]
                : [0, 0, 0, 0];
            return (
              <Bar
                key={name}
                dataKey={name}
                fill={colorByNameMap[name]}
                stackId="a"
                isAnimationActive={false}
                // if there is only one segment, we want to round all corners
                radius={arr.length > 1 ? radius : DEFAULT_RADIUS}
              />
            );
          })}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
