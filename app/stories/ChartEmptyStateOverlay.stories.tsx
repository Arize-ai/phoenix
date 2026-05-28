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

const chartData = [
  { name: "Mon", value: 24 },
  { name: "Tue", value: 32 },
  { name: "Wed", value: 18 },
  { name: "Thu", value: 41 },
  { name: "Fri", value: 29 },
];

function ExampleChart({ isEmpty }: { isEmpty: boolean }) {
  const data = isEmpty ? [] : chartData;
  return (
    <div style={{ width: "100%", height: 280 }}>
      <ChartEmptyStateOverlay
        isEmpty={isEmpty}
        message="No data in this time range"
      >
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
