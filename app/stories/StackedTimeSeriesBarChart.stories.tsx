import type { Meta, StoryObj } from "@storybook/react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";

import { Card, Flex, Text, View } from "@phoenix/components";
import {
  ChartTooltip,
  ChartTooltipItem,
  defaultBarChartTooltipProps,
  defaultCartesianGridProps,
  defaultLegendProps,
  defaultXAxisProps,
  defaultYAxisProps,
  SEQUENTIAL_CHART_COLORS,
  SequentialChartColors,
  useSequentialChartColors,
  useTimeTickFormatter,
} from "@phoenix/components/chart";
import { PreferencesProvider } from "@phoenix/contexts";
import { useTimeFormatters } from "@phoenix/hooks/useTimeFormatters";
import { ViewerPreferences } from "@phoenix/pages/profile/ViewerPreferences";
import { calculateGranularity } from "@phoenix/utils/timeSeriesUtils";

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

const lowVolumeData = [
  {
    timestamp: "2021-01-01",
    ok: 10,
    error: 1,
  },
  {
    timestamp: "2021-01-02",
    ok: 12,
    error: 0,
  },
  {
    timestamp: "2021-01-03",
    ok: 8,
    error: 2,
  },
  {
    timestamp: "2021-01-04",
    ok: 15,
    error: 1,
  },
  {
    timestamp: "2021-01-05",
    ok: 11,
    error: 0,
  },
];

const highVolumeData = [
  {
    timestamp: "2021-01-01",
    ok: 1000,
    error: 100,
  },
  {
    timestamp: "2021-01-02",
    ok: 1200,
    error: 150,
  },
  {
    timestamp: "2021-01-03",
    ok: 800,
    error: 50,
  },
  {
    timestamp: "2021-01-04",
    ok: 1500,
    error: 200,
  },
  {
    timestamp: "2021-01-05",
    ok: 1100,
    error: 80,
  },
];

function TooltipContent({
  active,
  payload,
  label,
}: TooltipContentProps<number, string>) {
  const chartColors = useSequentialChartColors();
  const { fullTimeFormatter } = useTimeFormatters();

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
        {label && (
          <Text weight="heavy" size="S">{`${fullTimeFormatter(
            new Date(label)
          )}`}</Text>
        )}
        <ChartTooltipItem
          color={chartColors.red300}
          shape="circle"
          name="error"
          value={metricString}
        />
        <ChartTooltipItem
          color={chartColors.default}
          shape="circle"
          name="ok"
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
    ok: number;
    error: number;
  }>;
  height?: number | string;
  firstColor?: keyof SequentialChartColors;
  secondColor?: keyof SequentialChartColors;
}

function StackedBarChart({
  data = chartData,
  height = 200,
  firstColor = "red300",
  secondColor = "default",
}: StackedBarChartProps) {
  const timeRange = {
    start: new Date("2021-01-01"),
    end: new Date("2021-01-11"),
  };

  const granularity = calculateGranularity(timeRange);
  const timeTickFormatter = useTimeTickFormatter({
    samplingIntervalMinutes: granularity.samplingIntervalMinutes,
  });

  const colors = useSequentialChartColors();

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 0, right: 18, left: 0, bottom: 0 }}
          barSize={10}
        >
          <XAxis
            {...defaultXAxisProps}
            dataKey="timestamp"
            tickFormatter={(x) => timeTickFormatter(new Date(x))}
          />
          <YAxis
            {...defaultYAxisProps}
            width={50}
            label={{
              value: "Trace Count",
              angle: -90,
              dx: -10,
              style: {
                textAnchor: "middle",
                fill: "var(--chart-axis-label-color)",
              },
            }}
          />

          <CartesianGrid {...defaultCartesianGridProps} vertical={false} />
          <Tooltip {...defaultBarChartTooltipProps} content={TooltipContent} />
          <Bar dataKey="error" stackId="a" fill={colors[firstColor]} />
          <Bar
            dataKey="ok"
            stackId="a"
            fill={colors[secondColor]}
            radius={[2, 2, 0, 0]}
          />

          <Legend
            align="left"
            iconType="circle"
            iconSize={8}
            {...defaultLegendProps}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const meta: Meta<typeof StackedBarChart> = {
  title: "Charting/StackedTimeSeriesBarChart",
  component: StackedBarChart,
  decorators: [
    (Story) => (
      <PreferencesProvider>
        <Story />
      </PreferencesProvider>
    ),
  ],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    height: {
      control: { type: "number" },
      description: "Height of the chart",
    },
    firstColor: {
      control: { type: "select" },
      options: SEQUENTIAL_CHART_COLORS,
    },
    secondColor: {
      control: { type: "select" },
      options: SEQUENTIAL_CHART_COLORS,
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

/**
 * Demonstrates how the chart respects timezone preferences.
 * The tooltip timestamps will be formatted according to the selected timezone.
 * Change the timezone in the preferences and hover over the chart bars to see
 * the timestamps update in the tooltip.
 */
export const WithTimezonePreferences: Story = {
  decorators: [
    (Story) => (
      <Flex direction="column" gap="size-200">
        <ViewerPreferences />
        <Card title="Chart with Timezone-Aware Tooltips">
          <View padding="size-200">
            <Story />
          </View>
        </Card>
      </Flex>
    ),
  ],
  args: {
    data: chartData,
    height: 400,
  },
};
