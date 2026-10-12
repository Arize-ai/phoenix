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
  ChartSkeleton,
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

/**
 * What a chart shows when it has nothing to draw yet. While its data loads, a
 * chart renders a `ChartSkeleton`: a static placeholder chart that shares the
 * real charts' margins, axes, and grid, so the swap to the loaded chart does
 * not shift the layout. Once loaded with no data, the real chart is wrapped in
 * a `ChartEmptyStateOverlay`, which masks it and centers a message explaining
 * why it is empty.
 */
const meta: Meta<typeof ExampleChart> = {
  title: "Design System/Data visualization/Chart Loading and Empty States",
  tags: ["legacy", "unreviewed"],
  component: ExampleChart,
  subcomponents: { ChartEmptyStateOverlay, ChartSkeleton },
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

/** The loading placeholder at a typical chart height. */
export const Skeleton: Story = {
  parameters: { layout: "centered", controls: { disable: true } },
  render: () => (
    <div style={{ width: 400, height: 190 }}>
      <ChartSkeleton />
    </div>
  ),
};

/** The loading placeholder in a short container. */
export const SkeletonCompact: Story = {
  parameters: { layout: "centered", controls: { disable: true } },
  render: () => (
    <div style={{ width: 400, height: 100 }}>
      <ChartSkeleton />
    </div>
  ),
};

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

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: Story = {
  tags: ["!dev", "!autodocs"],
  // The example chart is 280px tall.
  parameters: { thumbnail: { scale: 0.6 } },
  render: () => (
    <div style={{ width: "100%" }}>
      <ExampleChart isEmpty />
    </div>
  ),
};
