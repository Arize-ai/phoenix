import type { Meta, StoryObj } from "@storybook/react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CATEGORICAL_CHART_COLORS } from "./constants/colorConstants";

// Generate some sample data spanning a week
const sampleData = [
  {
    timestamp: "2024-01-01",
    item1: 120,
    item2: 90,
    item3: 60,
    item4: 30,
    item5: 45,
    item6: 75,
  },
  {
    timestamp: "2024-01-02",
    item1: 80,
    item2: 70,
    item3: 50,
    item4: 40,
    item5: 35,
    item6: 65,
  },
  {
    timestamp: "2024-01-03",
    item1: 100,
    item2: 85,
    item3: 55,
    item4: 25,
    item5: 60,
    item6: 80,
  },
  {
    timestamp: "2024-01-04",
    item1: 90,
    item2: 95,
    item3: 70,
    item4: 50,
    item5: 40,
    item6: 60,
  },
  {
    timestamp: "2024-01-05",
    item1: 110,
    item2: 75,
    item3: 65,
    item4: 35,
    item5: 55,
    item6: 85,
  },
];

const ITEM_KEYS = [
  "item1",
  "item2",
  "item3",
  "item4",
  "item5",
  "item6",
] as const;

interface StackColorChartProps {
  data?: typeof sampleData;
  height?: number | string;
}

function StackColorChart({
  data = sampleData,
  height = 300,
}: StackColorChartProps) {
  // Prepare colors for the six bars
  const barColors = CATEGORICAL_CHART_COLORS.slice(0, 6).map(
    (token) => `var(--ac-global-color-${token})`
  );

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 16, right: 24, left: 0, bottom: 16 }}
          barSize={14}
        >
          <CartesianGrid
            strokeDasharray="4 4"
            stroke="var(--ac-global-color-grey-500)"
            vertical={false}
          />
          <XAxis
            dataKey="timestamp"
            stroke="var(--ac-global-color-grey-500)"
            style={{ fill: "var(--ac-global-text-color-700)" }}
          />
          <YAxis
            stroke="var(--ac-global-color-grey-500)"
            style={{ fill: "var(--ac-global-text-color-700)" }}
          />
          <Tooltip
            cursor={{ fill: "var(--chart-tooltip-cursor-fill-color)" }}
          />
          {ITEM_KEYS.map((key, index) => (
            <Bar
              key={key}
              dataKey={key}
              stackId="a"
              fill={barColors[index]}
              radius={index === 0 ? [2, 2, 0, 0] : undefined}
            />
          ))}
          <Legend align="left" iconType="circle" iconSize={8} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Sample data for 12-item stack
const sampleData12 = [
  {
    timestamp: "2024-01-01",
    item1: 60,
    item2: 48,
    item3: 36,
    item4: 24,
    item5: 12,
    item6: 30,
    item7: 20,
    item8: 25,
    item9: 35,
    item10: 40,
    item11: 28,
    item12: 18,
  },
  {
    timestamp: "2024-01-02",
    item1: 55,
    item2: 45,
    item3: 33,
    item4: 22,
    item5: 11,
    item6: 28,
    item7: 18,
    item8: 22,
    item9: 30,
    item10: 35,
    item11: 25,
    item12: 15,
  },
  {
    timestamp: "2024-01-03",
    item1: 65,
    item2: 50,
    item3: 38,
    item4: 26,
    item5: 13,
    item6: 32,
    item7: 22,
    item8: 26,
    item9: 37,
    item10: 42,
    item11: 30,
    item12: 20,
  },
  {
    timestamp: "2024-01-04",
    item1: 70,
    item2: 55,
    item3: 40,
    item4: 28,
    item5: 14,
    item6: 34,
    item7: 24,
    item8: 28,
    item9: 39,
    item10: 45,
    item11: 32,
    item12: 22,
  },
  {
    timestamp: "2024-01-05",
    item1: 68,
    item2: 52,
    item3: 39,
    item4: 27,
    item5: 13,
    item6: 33,
    item7: 23,
    item8: 27,
    item9: 38,
    item10: 43,
    item11: 31,
    item12: 21,
  },
];

const ITEM_KEYS_12 = [
  "item1",
  "item2",
  "item3",
  "item4",
  "item5",
  "item6",
  "item7",
  "item8",
  "item9",
  "item10",
  "item11",
  "item12",
] as const;

function StackColorChart12({
  data = sampleData12,
  height = 300,
}: {
  data?: typeof sampleData12;
  height?: number | string;
}) {
  const barColors = CATEGORICAL_CHART_COLORS.slice(0, 12).map(
    (token) => `var(--ac-global-color-${token})`
  );

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 16, right: 24, left: 0, bottom: 16 }}
          barSize={12}
        >
          <CartesianGrid
            strokeDasharray="4 4"
            stroke="var(--ac-global-color-grey-500)"
            vertical={false}
          />
          <XAxis
            dataKey="timestamp"
            stroke="var(--ac-global-color-grey-500)"
            style={{ fill: "var(--ac-global-text-color-700)" }}
          />
          <YAxis
            stroke="var(--ac-global-color-grey-500)"
            style={{ fill: "var(--ac-global-text-color-700)" }}
          />
          <Tooltip
            cursor={{ fill: "var(--chart-tooltip-cursor-fill-color)" }}
          />
          {ITEM_KEYS_12.map((key, index) => (
            <Bar
              key={key}
              dataKey={key}
              stackId="a"
              fill={barColors[index]}
              radius={index === 0 ? [2, 2, 0, 0] : undefined}
            />
          ))}
          <Legend align="left" iconType="circle" iconSize={8} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const meta: Meta<typeof StackColorChart> = {
  title: "Charts/Stack Color Examples",
  component: StackColorChart,
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
type Story = StoryObj<typeof StackColorChart>;

export const Default: Story = {
  args: {
    data: sampleData,
    height: 400,
  },
};

export const TwelveColors: Story = {
  render: () => <StackColorChart12 data={sampleData12} height={400} />,
};
