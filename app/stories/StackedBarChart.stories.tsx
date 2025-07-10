import type { Meta, StoryObj } from "@storybook/react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  TooltipProps,
  XAxis,
  YAxis,
} from "recharts";

import { Text } from "@phoenix/components";
import {
  ChartTooltip,
  ChartTooltipItem,
  useChartColors,
  useTimeTickFormatter,
} from "@phoenix/components/chart";
import { fullTimeFormatter } from "@phoenix/utils/timeFormatUtils";
import { calculateGranularity } from "@phoenix/utils/timeSeriesUtils";

const numberFormatter = new Intl.NumberFormat([], {
  maximumFractionDigits: 2,
});

const chartData = [
  {
    timestamp: "2021-01-01",
    traceCount: 100,
    errorCount: 10,
  },
  {
    timestamp: "2021-01-02",
    traceCount: 120,
    errorCount: 15,
  },
  {
    timestamp: "2021-01-03",
    traceCount: 80,
    errorCount: 5,
  },
  {
    timestamp: "2021-01-04",
    traceCount: 150,
    errorCount: 20,
  },
  {
    timestamp: "2021-01-05",
    traceCount: 110,
    errorCount: 8,
  },
  {
    timestamp: "2021-01-06",
    traceCount: 90,
    errorCount: 12,
  },
  {
    timestamp: "2021-01-07",
    traceCount: 130,
    errorCount: 18,
  },
  {
    timestamp: "2021-01-08",
    traceCount: 95,
    errorCount: 7,
  },
  {
    timestamp: "2021-01-09",
    traceCount: 140,
    errorCount: 22,
  },
  {
    timestamp: "2021-01-10",
    traceCount: 105,
    errorCount: 11,
  },
  {
    timestamp: "2021-01-11",
    traceCount: 125,
    errorCount: 16,
  },
];

const lowVolumeData = [
  {
    timestamp: "2021-01-01",
    traceCount: 10,
    errorCount: 1,
  },
  {
    timestamp: "2021-01-02",
    traceCount: 12,
    errorCount: 0,
  },
  {
    timestamp: "2021-01-03",
    traceCount: 8,
    errorCount: 2,
  },
  {
    timestamp: "2021-01-04",
    traceCount: 15,
    errorCount: 1,
  },
  {
    timestamp: "2021-01-05",
    traceCount: 11,
    errorCount: 0,
  },
];

const highVolumeData = [
  {
    timestamp: "2021-01-01",
    traceCount: 1000,
    errorCount: 100,
  },
  {
    timestamp: "2021-01-02",
    traceCount: 1200,
    errorCount: 150,
  },
  {
    timestamp: "2021-01-03",
    traceCount: 800,
    errorCount: 50,
  },
  {
    timestamp: "2021-01-04",
    traceCount: 1500,
    errorCount: 200,
  },
  {
    timestamp: "2021-01-05",
    traceCount: 1100,
    errorCount: 80,
  },
];

function TooltipContent({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  const chartColors = useChartColors();
  if (active && payload && payload.length) {
    const metricValue = payload[1]?.value ?? null;
    const count = payload[0]?.value ?? null;
    const metricString =
      typeof metricValue === "number"
        ? numberFormatter.format(metricValue)
        : "--";
    const predictionCountString =
      typeof count === "number" ? numberFormatter.format(count) : "--";
    return (
      <ChartTooltip>
        <Text weight="heavy" size="S">{`${fullTimeFormatter(
          new Date(label)
        )}`}</Text>
        <ChartTooltipItem
          color={chartColors.red500}
          name={payload[1]?.payload.metricName ?? "Errors"}
          value={metricString}
        />
        <ChartTooltipItem
          color={chartColors.gray500}
          shape="square"
          name="Total Traces"
          value={predictionCountString}
        />
      </ChartTooltip>
    );
  }

  return null;
}

interface StackedBarChartProps {
  data?: Array<{
    timestamp: string;
    traceCount: number;
    errorCount: number;
  }>;
  height?: number | string;
}

function StackedBarChart({
  data = chartData,
  height = 400,
}: StackedBarChartProps) {
  const timeRange = {
    start: new Date("2021-01-01"),
    end: new Date("2021-01-11"),
  };

  const granularity = calculateGranularity(timeRange);
  const timeTickFormatter = useTimeTickFormatter({
    samplingIntervalMinutes: granularity.samplingIntervalMinutes,
  });

  const colors = useChartColors();

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 25, right: 18, left: 0, bottom: 0 }}
        >
          <XAxis
            dataKey="timestamp"
            tickFormatter={(x) => timeTickFormatter(new Date(x))}
            style={{ fill: "var(--ac-global-text-color-700)" }}
          />
          <YAxis
            stroke="var(--ac-global-color-grey-500)"
            label={{
              value: "Trace Count",
              angle: -90,
              style: {
                textAnchor: "middle",
                fill: "var(--ac-global-text-color-900)",
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
          <Tooltip content={<TooltipContent />} />
          <Bar dataKey="errorCount" stackId="a" fill={colors.red500} />
          <Bar
            dataKey="traceCount"
            stackId="a"
            fill={colors.gray600}
            radius={[2, 2, 0, 0]}
          />

          <Legend align="left" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const meta: Meta<typeof StackedBarChart> = {
  title: "Charts/StackedBarChart",
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

export const Default: Story = {
  args: {
    data: chartData,
    height: 400,
  },
};

export const LowVolume: Story = {
  args: {
    data: lowVolumeData,
    height: 400,
  },
};

export const HighVolume: Story = {
  args: {
    data: highVolumeData,
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
