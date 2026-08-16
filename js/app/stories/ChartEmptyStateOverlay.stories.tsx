import type { Meta, StoryObj } from "@storybook/react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartEmptyStateOverlay,
  defaultCartesianGridProps,
  defaultXAxisProps,
  defaultYAxisProps,
} from "@phoenix/components/chart";
import { getCostChartEmptyStateMessage } from "@phoenix/pages/project/metrics/tokenDetails";

const chartData = [
  { name: "Mon", value: 24 },
  { name: "Tue", value: 32 },
  { name: "Wed", value: 18 },
  { name: "Thu", value: 41 },
  { name: "Fri", value: 29 },
];

function ExampleChart({
  isEmpty,
  message = "No data in this time range",
}: {
  isEmpty: boolean;
  message?: string;
}) {
  const data = isEmpty ? [] : chartData;
  return (
    <div style={{ width: "100%", height: 280 }}>
      <ChartEmptyStateOverlay isEmpty={isEmpty} message={message}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 18, left: 8, bottom: 8 }}
            barSize={16}
          >
            <CartesianGrid {...defaultCartesianGridProps} vertical={false} />
            <XAxis {...defaultXAxisProps} dataKey="name" />
            <YAxis {...defaultYAxisProps} width={48} />
            <Tooltip />
            <Bar
              dataKey="value"
              fill="var(--global-color-gray-500)"
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartEmptyStateOverlay>
    </div>
  );
}

const meta: Meta<typeof ExampleChart> = {
  title: "Charting/Chart Empty State Overlay",
  component: ExampleChart,
  parameters: {
    layout: "padded",
  },
  argTypes: {
    isEmpty: {
      control: "boolean",
    },
  },
};

export default meta;
type Story = StoryObj<typeof ExampleChart>;

export const Empty: Story = {
  args: {
    isEmpty: true,
  },
};

export const WithData: Story = {
  args: {
    isEmpty: false,
  },
};

/**
 * The cost chart with nothing to draw because nothing ran in the range. This
 * is the only empty state a wider time range fixes.
 */
export const CostChartEmptyTimeRange: Story = {
  args: {
    isEmpty: true,
    message: getCostChartEmptyStateMessage({ modelCount: 0, tokenCount: 0 }),
  },
};

/**
 * The same chart for a project whose models have no pricing configured. Spans
 * ran and the token chart beside it draws full bars, but cost is only
 * attributed to a model once its pricing exists, so this chart has nothing to
 * show. Widening the range never helps, and the copy says so.
 *
 * Both messages come from the component's own helper so the story cannot drift
 * from what ships.
 */
export const CostChartMissingPricing: Story = {
  args: {
    isEmpty: true,
    message: getCostChartEmptyStateMessage({ modelCount: 0, tokenCount: 4200 }),
  },
};
