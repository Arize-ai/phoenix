import type { Meta, StoryObj } from "@storybook/react";
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

const meta: Meta<typeof ChartPanel> = {
  title: "Charting/Chart Panel",
  component: ChartPanel,
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
