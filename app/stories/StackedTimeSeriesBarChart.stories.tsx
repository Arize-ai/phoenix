import { useEffect, useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  RectangleProps,
  ResponsiveContainer,
  Tooltip,
  TooltipProps,
  XAxis,
  YAxis,
} from "recharts";
import { css } from "@emotion/react";

import { Text } from "@phoenix/components";
import {
  ChartTooltip,
  ChartTooltipItem,
  useTimeTickFormatter,
} from "@phoenix/components/chart";
import { fullTimeFormatter } from "@phoenix/utils/timeFormatUtils";
import { calculateGranularity } from "@phoenix/utils/timeSeriesUtils";

import { CATEGORICAL_CHART_COLORS } from "./constants/colorConstants";

const numberFormatter = new Intl.NumberFormat([], {
  maximumFractionDigits: 2,
});

const chartData = [
  {
    timestamp: "2021-01-01",
    ok: 100,
    error: 10,
  },
  {
    timestamp: "2021-01-02",
    ok: 120,
    error: 15,
  },
  {
    timestamp: "2021-01-03",
    ok: 80,
    error: 5,
  },
  {
    timestamp: "2021-01-04",
    ok: 150,
    error: 20,
  },
  {
    timestamp: "2021-01-05",
    ok: 110,
    error: 8,
  },
  {
    timestamp: "2021-01-06",
    ok: 90,
    error: 12,
  },
  {
    timestamp: "2021-01-07",
    ok: 130,
    error: 18,
  },
  {
    timestamp: "2021-01-08",
    ok: 95,
    error: 7,
  },
  {
    timestamp: "2021-01-09",
    ok: 140,
    error: 22,
  },
  {
    timestamp: "2021-01-10",
    ok: 105,
    error: 11,
  },
  {
    timestamp: "2021-01-11",
    ok: 125,
    error: 16,
  },
];

// Data for 6 segments
const sixSegmentData = [
  {
    timestamp: "2021-01-01",
    segment1: 20,
    segment2: 30,
    segment3: 25,
    segment4: 15,
    segment5: 35,
    segment6: 40,
  },
  {
    timestamp: "2021-01-02",
    segment1: 25,
    segment2: 28,
    segment3: 22,
    segment4: 18,
    segment5: 30,
    segment6: 38,
  },
  {
    timestamp: "2021-01-03",
    segment1: 18,
    segment2: 32,
    segment3: 28,
    segment4: 20,
    segment5: 25,
    segment6: 35,
  },
  {
    timestamp: "2021-01-04",
    segment1: 30,
    segment2: 35,
    segment3: 20,
    segment4: 25,
    segment5: 40,
    segment6: 45,
  },
  {
    timestamp: "2021-01-05",
    segment1: 22,
    segment2: 26,
    segment3: 30,
    segment4: 16,
    segment5: 28,
    segment6: 42,
  },
  {
    timestamp: "2021-01-06",
    segment1: 24,
    segment2: 29,
    segment3: 26,
    segment4: 19,
    segment5: 32,
    segment6: 36,
  },
  {
    timestamp: "2021-01-07",
    segment1: 28,
    segment2: 33,
    segment3: 24,
    segment4: 22,
    segment5: 38,
    segment6: 41,
  },
  {
    timestamp: "2021-01-08",
    segment1: 19,
    segment2: 27,
    segment3: 29,
    segment4: 17,
    segment5: 26,
    segment6: 37,
  },
  {
    timestamp: "2021-01-09",
    segment1: 31,
    segment2: 36,
    segment3: 21,
    segment4: 24,
    segment5: 39,
    segment6: 44,
  },
  {
    timestamp: "2021-01-10",
    segment1: 23,
    segment2: 25,
    segment3: 27,
    segment4: 15,
    segment5: 29,
    segment6: 40,
  },
  {
    timestamp: "2021-01-11",
    segment1: 26,
    segment2: 31,
    segment3: 23,
    segment4: 21,
    segment5: 34,
    segment6: 39,
  },
];

// Data for 12 segments
const twelveSegmentData = [
  {
    timestamp: "2021-01-01",
    segment1: 10,
    segment2: 12,
    segment3: 8,
    segment4: 15,
    segment5: 11,
    segment6: 13,
    segment7: 9,
    segment8: 14,
    segment9: 7,
    segment10: 16,
    segment11: 10,
    segment12: 12,
  },
  {
    timestamp: "2021-01-02",
    segment1: 11,
    segment2: 13,
    segment3: 9,
    segment4: 14,
    segment5: 12,
    segment6: 15,
    segment7: 8,
    segment8: 13,
    segment9: 10,
    segment10: 17,
    segment11: 11,
    segment12: 14,
  },
  {
    timestamp: "2021-01-03",
    segment1: 9,
    segment2: 11,
    segment3: 10,
    segment4: 13,
    segment5: 10,
    segment6: 14,
    segment7: 7,
    segment8: 15,
    segment9: 8,
    segment10: 16,
    segment11: 9,
    segment12: 13,
  },
  {
    timestamp: "2021-01-04",
    segment1: 12,
    segment2: 14,
    segment3: 11,
    segment4: 16,
    segment5: 13,
    segment6: 16,
    segment7: 10,
    segment8: 17,
    segment9: 9,
    segment10: 18,
    segment11: 12,
    segment12: 15,
  },
  {
    timestamp: "2021-01-05",
    segment1: 10,
    segment2: 12,
    segment3: 9,
    segment4: 14,
    segment5: 11,
    segment6: 15,
    segment7: 8,
    segment8: 14,
    segment9: 7,
    segment10: 17,
    segment11: 10,
    segment12: 13,
  },
  {
    timestamp: "2021-01-06",
    segment1: 11,
    segment2: 13,
    segment3: 10,
    segment4: 15,
    segment5: 12,
    segment6: 14,
    segment7: 9,
    segment8: 16,
    segment9: 8,
    segment10: 18,
    segment11: 11,
    segment12: 14,
  },
  {
    timestamp: "2021-01-07",
    segment1: 13,
    segment2: 15,
    segment3: 11,
    segment4: 17,
    segment5: 14,
    segment6: 17,
    segment7: 10,
    segment8: 18,
    segment9: 9,
    segment10: 19,
    segment11: 13,
    segment12: 16,
  },
  {
    timestamp: "2021-01-08",
    segment1: 9,
    segment2: 11,
    segment3: 8,
    segment4: 13,
    segment5: 10,
    segment6: 13,
    segment7: 7,
    segment8: 14,
    segment9: 6,
    segment10: 15,
    segment11: 9,
    segment12: 12,
  },
  {
    timestamp: "2021-01-09",
    segment1: 14,
    segment2: 16,
    segment3: 12,
    segment4: 18,
    segment5: 15,
    segment6: 18,
    segment7: 11,
    segment8: 19,
    segment9: 10,
    segment10: 20,
    segment11: 14,
    segment12: 17,
  },
  {
    timestamp: "2021-01-10",
    segment1: 10,
    segment2: 12,
    segment3: 9,
    segment4: 14,
    segment5: 11,
    segment6: 14,
    segment7: 8,
    segment8: 15,
    segment9: 7,
    segment10: 16,
    segment11: 10,
    segment12: 13,
  },
  {
    timestamp: "2021-01-11",
    segment1: 12,
    segment2: 14,
    segment3: 10,
    segment4: 16,
    segment5: 13,
    segment6: 16,
    segment7: 9,
    segment8: 17,
    segment9: 8,
    segment10: 18,
    segment11: 12,
    segment12: 15,
  },
];

function TooltipContent({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  if (active && payload && payload.length) {
    return (
      <ChartTooltip>
        <Text weight="heavy" size="S">{`${fullTimeFormatter(
          new Date(label)
        )}`}</Text>
        {payload.map((entry, index) => (
          <ChartTooltipItem
            key={entry.dataKey}
            color={
              entry.color ||
              `var(--ac-global-color-${CATEGORICAL_CHART_COLORS[index]})`
            }
            shape="circle"
            name={String(entry.dataKey)}
            value={
              typeof entry.value === "number"
                ? numberFormatter.format(entry.value)
                : "--"
            }
          />
        ))}
      </ChartTooltip>
    );
  }

  return null;
}

// Custom bar shape that includes a 2px gap at the top
const CustomBar = (props: RectangleProps) => {
  const { fill, x = 0, y = 0, width = 0, height = 0, radius } = props;

  // Don't render if height is too small
  if (height < 0.1) return null;

  // Render bar with 2px gap at top (except for very small bars)
  const gapHeight = height > 2 ? 2 : 0;
  const barHeight = height - gapHeight;
  const barY = y + gapHeight;

  // Handle radius for the top segment
  const radiusAttr =
    radius && typeof radius !== "number" && Array.isArray(radius)
      ? {
          rx: radius[0],
          ry: radius[1],
        }
      : {};

  return (
    <g>
      <rect
        x={x}
        y={barY}
        width={width}
        height={barHeight}
        fill={fill}
        {...radiusAttr}
      />
    </g>
  );
};

interface StackedBarChartProps {
  data?: Array<{
    timestamp: string;
    [key: string]: string | number;
  }>;
  height?: number | string;
}

// Custom Legend component that properly handles wrapping
interface CustomLegendProps {
  segmentKeys: string[];
  barColors: string[];
  yAxisWidth: number;
  legendRef?: React.RefObject<HTMLDivElement>;
}

function CustomLegend({
  segmentKeys,
  barColors,
  yAxisWidth,
  legendRef,
}: CustomLegendProps) {
  return (
    <div
      ref={legendRef}
      css={css`
        display: flex;
        flex-wrap: wrap;
        row-gap: 8px;
        column-gap: 12px;
        align-items: center;
        padding-left: ${yAxisWidth}px;
        width: calc(100% - ${yAxisWidth}px);
        max-width: 100%;
        margin-top: -10px; /* Negative margin to pull legend closer to chart */
        margin-bottom: 0;
      `}
    >
      {segmentKeys.map((key, index) => (
        <div
          key={key}
          css={css`
            display: flex;
            align-items: center;
            gap: 4px;
            color: var(--ac-global-text-color-700);
            font-size: 12px;
          `}
        >
          <div
            css={css`
              width: 8px;
              height: 8px;
              border-radius: 50%;
              background-color: ${barColors[index]};
              flex-shrink: 0;
            `}
          />
          <span>{key}</span>
        </div>
      ))}
    </div>
  );
}

function StackedBarChart({
  data = chartData,
  height = 200,
}: StackedBarChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);
  // Default to zero so that failures to adapt are obvious
  const [yAxisWidth, setYAxisWidth] = useState(0);
  const [legendHeight, setLegendHeight] = useState(0);

  const timeRange = {
    start: new Date("2021-01-01"),
    end: new Date("2021-01-11"),
  };

  const granularity = calculateGranularity(timeRange);
  const timeTickFormatter = useTimeTickFormatter({
    samplingIntervalMinutes: granularity.samplingIntervalMinutes,
  });

  // Get segment keys from the first data item (excluding timestamp)
  const segmentKeys =
    data && data.length > 0
      ? Object.keys(data[0]).filter((key) => key !== "timestamp")
      : [];

  // Use the appropriate number of categorical colors based on actual segments
  const barColors = CATEGORICAL_CHART_COLORS.slice(0, segmentKeys.length).map(
    (token) => `var(--ac-global-color-${token})`
  );

  const leftMargin = 0;

  // Measure the actual Y-axis width after render
  useEffect(() => {
    if (chartRef.current) {
      // Wait for chart to fully render
      const measureChart = () => {
        const chart = chartRef.current;
        if (!chart) return;

        // Find the vertical grid line (start of data area)
        const gridLine =
          chart.querySelector(
            '.recharts-cartesian-axis-line[orientation="left"]'
          ) ||
          chart.querySelector(".recharts-cartesian-grid-vertical line") ||
          chart.querySelector(".recharts-yAxis line");

        if (gridLine) {
          const gridBbox = gridLine.getBoundingClientRect();
          const chartBbox = chart.getBoundingClientRect();

          // Calculate Y-axis width
          const measuredYAxisWidth = gridBbox.left - chartBbox.left;

          if (measuredYAxisWidth > 0 && measuredYAxisWidth < 200) {
            setYAxisWidth(Math.ceil(measuredYAxisWidth));
          }
        }

        // Measure legend height
        if (legendRef.current) {
          const legendRect = legendRef.current.getBoundingClientRect();
          setLegendHeight(Math.ceil(legendRect.height));
        }
      };

      setTimeout(measureChart, 20);
    }
  }, [data]); // Re-measure if data changes

  // Calculate the chart height based on total height minus legend height
  const chartHeight =
    typeof height === "number"
      ? Math.max(height - legendHeight, 100) // Ensure minimum chart height
      : height;

  return (
    <div ref={chartRef} style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={data}
          margin={{
            top: 5,
            right: 5,
            left: leftMargin,
            bottom: 8,
          }}
          barSize={10}
        >
          <XAxis
            dataKey="timestamp"
            tickFormatter={(x) => timeTickFormatter(new Date(x))}
            style={{ fill: "var(--ac-global-text-color-700)" }}
            stroke="var(--ac-global-color-grey-400)"
          />
          <YAxis
            stroke="var(--ac-global-color-grey-500)"
            tick={{ fontSize: 12 }}
            label={{
              value: "Trace Count",
              angle: -90,
              position: "insideLeft",
              offset: 12,
              style: {
                textAnchor: "middle",
                fill: "var(--ac-global-text-color-900)",
                fontSize: 12,
              },
            }}
            style={{ fill: "var(--ac-global-text-color-700)" }}
          />

          <CartesianGrid
            strokeDasharray="4 4"
            stroke="var(--ac-global-color-grey-500)"
            strokeOpacity={0.5}
            vertical={false}
          />
          <Tooltip
            content={<TooltipContent />}
            cursor={{ fill: "var(--chart-tooltip-cursor-fill-color)" }}
          />
          {segmentKeys.map((key, index) => (
            <Bar
              key={key}
              dataKey={key}
              stackId="a"
              fill={barColors[index]}
              radius={
                index === segmentKeys.length - 1 ? [2, 2, 0, 0] : undefined
              }
              isAnimationActive={false}
              shape={<CustomBar />}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <CustomLegend
        segmentKeys={segmentKeys}
        barColors={barColors}
        yAxisWidth={yAxisWidth}
        legendRef={legendRef}
      />
    </div>
  );
}

const meta: Meta<typeof StackedBarChart> = {
  title: "Charts/StackedTimeSeriesBarChart",
  component: StackedBarChart,
  parameters: {
    layout: "padded",
  },
  argTypes: {
    height: {
      control: { type: "number" },
      description: "Height of the chart",
    },
  },
};

export default meta;
type Story = StoryObj<typeof StackedBarChart>;

export const TwoSegments: Story = {
  args: {
    data: chartData,
    height: 400,
  },
};

export const SixSegments: Story = {
  args: {
    data: sixSegmentData,
    height: 400,
  },
};

export const TwelveSegments: Story = {
  args: {
    data: twelveSegmentData,
    height: 400,
  },
};

export const Compact: Story = {
  args: {
    data: chartData,
    height: 300,
  },
};

export const Tall: Story = {
  args: {
    data: chartData,
    height: 600,
  },
};
