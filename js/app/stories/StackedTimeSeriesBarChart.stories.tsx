import type { Meta, StoryObj } from "@storybook/react";
import type { LegendPayload, TooltipContentProps } from "recharts";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { expect, within } from "storybook/test";

import { Card, Flex, Text, View } from "@phoenix/components";
import type { SequentialChartColors } from "@phoenix/components/chart";
import {
  ChartTooltip,
  ChartTooltipItem,
  InteractiveLegend,
  SEQUENTIAL_CHART_COLORS,
  defaultTooltipProps,
  defaultCartesianGridProps,
  defaultLegendProps,
  defaultXAxisProps,
  defaultYAxisProps,
  useInteractiveLegend,
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

const LONG_ERROR_SERIES_NAME =
  "errors_from_policy_validation_grounding_citation_completeness_and_escalation_checks";
const LONG_OK_SERIES_NAME =
  "successful traces that passed every production quality gate without requiring human review";
const LONG_STATIC_SERIES_NAME =
  "production_baseline_for_multilingual_safety_sensitive_customer_support_workflows";

function TooltipContent({ active, payload, label }: TooltipContentProps) {
  const { fullTimeFormatter } = useTimeFormatters();

  if (active && payload && payload.length) {
    return (
      <ChartTooltip>
        {label && (
          <Text weight="heavy" size="S">{`${fullTimeFormatter(
            new Date(label)
          )}`}</Text>
        )}
        {payload.map((entry) => {
          const name = String(entry.dataKey ?? entry.name ?? "unknown");
          return (
            <ChartTooltipItem
              color={entry.color ?? "transparent"}
              key={name}
              shape="circle"
              name={name}
              value={
                typeof entry.value === "number"
                  ? numberFormatter.format(entry.value)
                  : "--"
              }
            />
          );
        })}
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
  firstSeriesName?: string;
  secondSeriesName?: string;
  additionalLegendItems?: ReadonlyArray<LegendPayload>;
}

function StackedBarChart({
  data = chartData,
  height = 200,
  firstColor = "red300",
  secondColor = "default",
  firstSeriesName = "error",
  secondSeriesName = "ok",
  additionalLegendItems,
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
  const { hiddenDataKeys, isDataKeyHidden, toggleDataKey } =
    useInteractiveLegend();

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
          <Tooltip {...defaultTooltipProps} content={TooltipContent} />
          <Bar
            dataKey="error"
            stackId="a"
            fill={colors[firstColor]}
            hide={isDataKeyHidden("error")}
            name={firstSeriesName}
          />
          <Bar
            dataKey="ok"
            stackId="a"
            fill={colors[secondColor]}
            hide={isDataKeyHidden("ok")}
            name={secondSeriesName}
            radius={[2, 2, 0, 0]}
          />

          <InteractiveLegend
            align="left"
            additionalLegendItems={additionalLegendItems}
            hiddenDataKeys={hiddenDataKeys}
            iconType="circle"
            iconSize={8}
            onToggleDataKey={toggleDataKey}
            {...defaultLegendProps}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const meta: Meta<typeof StackedBarChart> = {
  title: "Charting/Stacked Time Series Bar Chart",
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
 * Long interactive and supplemental legend labels remain inside their items,
 * truncate with an ellipsis, and inherit the same neutral label color.
 */
export const LongLegendNames: Story = {
  args: {
    additionalLegendItems: [
      {
        color: "var(--global-color-purple-700)",
        type: "plainline",
        value: LONG_STATIC_SERIES_NAME,
      },
    ],
    data: chartData,
    firstSeriesName: LONG_ERROR_SERIES_NAME,
    height: 400,
    secondSeriesName: LONG_OK_SERIES_NAME,
  },
  render: (args) => (
    <div style={{ width: "320px" }}>
      <StackedBarChart {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    for (const label of [LONG_ERROR_SERIES_NAME, LONG_OK_SERIES_NAME]) {
      const legendButton = await canvas.findByRole("button", {
        name: `Hide ${label}`,
      });
      const legendText = legendButton.querySelector<HTMLElement>(
        ".recharts-legend-item-text"
      );
      const truncatedLabel = legendText?.firstElementChild;

      if (!(truncatedLabel instanceof HTMLElement)) {
        throw new Error(`Missing truncated legend label for ${label}`);
      }

      await expect(legendButton).toHaveAttribute("title", label);
      await expect(truncatedLabel).toHaveAttribute("title", label);
      await expect(truncatedLabel.scrollWidth).toBeGreaterThan(
        truncatedLabel.clientWidth
      );
      await expect(
        truncatedLabel.getBoundingClientRect().right
      ).toBeLessThanOrEqual(legendButton.getBoundingClientRect().right + 1);
      await expect(getComputedStyle(truncatedLabel).color).toBe(
        getComputedStyle(legendButton).color
      );
    }

    const staticTruncatedLabel = await canvas.findByTitle(
      LONG_STATIC_SERIES_NAME
    );
    const staticLegendText = staticTruncatedLabel.parentElement;
    const staticLegendItem = staticLegendText?.parentElement;

    if (!(staticLegendItem instanceof HTMLElement)) {
      throw new Error("Missing static legend item");
    }

    await expect(staticTruncatedLabel.scrollWidth).toBeGreaterThan(
      staticTruncatedLabel.clientWidth
    );
    await expect(
      staticTruncatedLabel.getBoundingClientRect().right
    ).toBeLessThanOrEqual(staticLegendItem.getBoundingClientRect().right + 1);
    await expect(getComputedStyle(staticTruncatedLabel).color).toBe(
      getComputedStyle(staticLegendItem).color
    );
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
