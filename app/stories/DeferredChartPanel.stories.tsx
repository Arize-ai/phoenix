import type { Meta, StoryObj } from "@storybook/react";
import { Suspense, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartPanel,
  ChartSkeleton,
  DeferredChartPanel,
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

function ExampleChart() {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        margin={{ top: 8, right: 18, left: 8, bottom: 8 }}
        barSize={16}
      >
        <CartesianGrid {...defaultCartesianGridProps} vertical={false} />
        <XAxis {...defaultXAxisProps} dataKey="name" />
        <YAxis {...defaultYAxisProps} width={48} />
        <Bar
          dataKey="value"
          fill="var(--global-color-gray-500)"
          radius={[2, 2, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Simulates a chart that fetches on mount: suspends for a moment the first
 * time it renders, like a Relay query would.
 */
function SlowExampleChartPanel({ title }: { title: string }) {
  const [promise] = useState(
    () => new Promise((resolve) => setTimeout(resolve, 1500))
  );
  return (
    <ChartPanel title={title} subtitle="Loads when scrolled into view">
      <Suspense fallback={<ChartSkeleton />}>
        <SuspendOnce promise={promise}>
          <ExampleChart />
        </SuspendOnce>
      </Suspense>
    </ChartPanel>
  );
}

function SuspendOnce({
  promise,
  children,
}: {
  promise: Promise<unknown>;
  children: React.ReactNode;
}) {
  const [isResolved, setIsResolved] = useState(false);
  if (!isResolved) {
    throw promise.then(() => setIsResolved(true));
  }
  return children;
}

const meta: Meta<typeof DeferredChartPanel> = {
  title: "Charting/DeferredChartPanel",
  component: DeferredChartPanel,
  parameters: {
    layout: "padded",
  },
};

export default meta;

type Story = StoryObj<typeof DeferredChartPanel>;

/**
 * A long scrolling column of deferred panels: each one shows its skeleton
 * placeholder until scrolled into view, then mounts (and "loads") its chart.
 */
export const ScrollToLoad: Story = {
  render: () => (
    <div style={{ height: 480, overflow: "auto" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {Array.from({ length: 12 }, (_, index) => (
          <DeferredChartPanel
            key={index}
            title={`Chart ${index + 1}`}
            subtitle="Loads when scrolled into view"
          >
            <SlowExampleChartPanel title={`Chart ${index + 1}`} />
          </DeferredChartPanel>
        ))}
      </div>
    </div>
  ),
};

/**
 * The placeholder panel shown before a deferred chart has ever been visible:
 * the real title and subtitle over a skeleton chart body.
 */
export const Placeholder: Story = {
  render: () => (
    <div style={{ width: 480 }}>
      <ChartPanel title="Traffic" subtitle="Spans by status">
        <ChartSkeleton />
      </ChartPanel>
    </div>
  ),
};
