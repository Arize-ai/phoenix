import type { Meta, StoryObj } from "@storybook/react";
import { Suspense, useState } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
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
  ChartPanel,
  ChartSkeleton,
  DeferredChartPanel,
  defaultCartesianGridProps,
  defaultXAxisProps,
  defaultYAxisProps,
} from "@phoenix/components/chart";
import { transparentResizeHandleCSS } from "@phoenix/components/resize";

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
        <Tooltip />
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

/**
 * `ChartPanel` frames a chart with a title and subtitle. `DeferredChartPanel`
 * wraps it for long pages of charts: until the panel has been scrolled into
 * view it renders the same title and subtitle over a `ChartSkeleton`, and only
 * then mounts (and fetches) the real chart.
 */
const meta: Meta<typeof ChartPanel> = {
  title: "Design System/Data visualization/Chart Panel",
  tags: ["legacy", "unreviewed"],
  component: ChartPanel,
  subcomponents: { DeferredChartPanel },
  parameters: {
    layout: "padded",
  },
  argTypes: {
    title: { control: "text" },
    subtitle: { control: "text" },
    fillHeight: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof ChartPanel>;

/**
 * The default panel renders its chart at a fixed height, used when charts are
 * stacked in a scrolling page (e.g. the project metrics page).
 */
export const Default: Story = {
  args: {
    title: "Traffic",
    subtitle: "Spans by status",
    fillHeight: false,
    children: <ExampleChart />,
  },
};

/**
 * With `fillHeight`, the panel stretches its chart to the height imposed by a
 * parent — e.g. a resizable panel — and drops the subtitle when short. This is
 * how the charts strip above tables and the experiments analysis view read as
 * chart panels.
 */
export const FillHeightInResizablePanel: Story = {
  render: (args) => (
    <div style={{ width: "480px", height: "360px" }}>
      <Group orientation="vertical">
        <Panel defaultSize="55%" style={{ overflow: "visible" }}>
          <div
            style={{
              height: "100%",
              padding: "var(--global-dimension-size-100)",
            }}
          >
            <ChartPanel {...args} fillHeight>
              <ExampleChart />
            </ChartPanel>
          </div>
        </Panel>
        <Separator css={transparentResizeHandleCSS} />
        <Panel />
      </Group>
    </div>
  ),
  args: {
    title: "Experiments Analysis",
    subtitle: "Annotation scores and latency by experiment",
  },
};

/**
 * Deferred loading: a long scrolling column of `DeferredChartPanel`s. Each
 * shows its skeleton placeholder until scrolled into view, then mounts (and
 * "loads") its chart.
 */
export const DeferredScrollToLoad: Story = {
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
 * The placeholder a `DeferredChartPanel` shows before it has ever been
 * visible: the real title and subtitle over a skeleton chart body.
 */
export const DeferredPlaceholder: Story = {
  render: () => (
    <div style={{ width: 480 }}>
      <ChartPanel title="Traffic" subtitle="Spans by status">
        <ChartSkeleton />
      </ChartPanel>
    </div>
  ),
};

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: Story = {
  tags: ["!dev", "!autodocs"],
  parameters: { thumbnail: { scale: 0.75 } },
  render: () => (
    <div style={{ width: "100%", height: "100%" }}>
      <ChartPanel title="Traffic" subtitle="Spans by status" fillHeight>
        <ExampleChart />
      </ChartPanel>
    </div>
  ),
};
