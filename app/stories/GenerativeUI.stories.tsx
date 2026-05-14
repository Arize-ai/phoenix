import type { Meta, StoryObj } from "@storybook/react";

import { BarChart } from "@phoenix/components/agent/GenerativeUI/BarChart";
import { ChartFrame } from "@phoenix/components/agent/GenerativeUI/ChartFrame";
import { GeneratedUIPlaceholder } from "@phoenix/components/agent/GenerativeUI/GeneratedUIPlaceholder";
import { LineChart } from "@phoenix/components/agent/GenerativeUI/LineChart";
import { StackedBarChart } from "@phoenix/components/agent/GenerativeUI/StackedBarChart";
import { VerticalBarChart } from "@phoenix/components/agent/GenerativeUI/VerticalBarChart";

const meta: Meta = {
  title: "Agent/GenerativeUI",
  parameters: {
    layout: "padded",
  },
};

export default meta;

// BarChart Stories

export const BarChartBasic: StoryObj<typeof BarChart> = {
  render: () => (
    <BarChart
      title="Issues by Category"
      data={[
        { label: "Payment", value: 18 },
        { label: "Access", value: 12 },
        { label: "Performance", value: 9 },
        { label: "Data/Export", value: 5 },
        { label: "Other", value: 3 },
      ]}
    />
  ),
};

// LineChart Stories

export const LineChartMultipleSeries: StoryObj<typeof LineChart> = {
  render: () => (
    <LineChart
      title="Trend Comparison"
      lines={[
        {
          label: "Frustrated",
          data: [12, 15, 11, 18, 14, 20, 17, 22, 19, 25, 21, 18],
        },
        {
          label: "Resolved",
          data: [8, 10, 9, 12, 11, 14, 12, 15, 13, 17, 14, 12],
        },
      ]}
      xLabels={[
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ]}
    />
  ),
};

// StackedBarChart Stories

export const StackedBarChartBasic: StoryObj<typeof StackedBarChart> = {
  render: () => (
    <StackedBarChart
      title="Token Usage by User"
      data={[
        {
          label: "Sarah",
          segments: [
            { label: "opus-4-5", value: 2400 },
            { label: "opus-4-6", value: 1800 },
            { label: "haiku-4-5", value: 400 },
          ],
        },
        {
          label: "Michael",
          segments: [
            { label: "opus-4-5", value: 1200 },
            { label: "opus-4-6", value: 2100 },
            { label: "haiku-4-5", value: 900 },
          ],
        },
        {
          label: "Alex",
          segments: [
            { label: "opus-4-5", value: 800 },
            { label: "opus-4-6", value: 1400 },
            { label: "haiku-4-5", value: 1600 },
          ],
        },
        {
          label: "Jordan",
          segments: [
            { label: "opus-4-5", value: 1900 },
            { label: "opus-4-6", value: 600 },
            { label: "haiku-4-5", value: 200 },
          ],
        },
        {
          label: "Taylor",
          segments: [
            { label: "opus-4-5", value: 500 },
            { label: "opus-4-6", value: 1100 },
            { label: "haiku-4-5", value: 800 },
          ],
        },
      ]}
    />
  ),
};

export const StackedBarChartTwoSegments: StoryObj<typeof StackedBarChart> = {
  render: () => (
    <StackedBarChart
      title="Cache Hit Ratio"
      data={[
        {
          label: "API",
          segments: [
            { label: "Hit", value: 850 },
            { label: "Miss", value: 150 },
          ],
        },
        {
          label: "DB",
          segments: [
            { label: "Hit", value: 720 },
            { label: "Miss", value: 280 },
          ],
        },
        {
          label: "Redis",
          segments: [
            { label: "Hit", value: 950 },
            { label: "Miss", value: 50 },
          ],
        },
      ]}
    />
  ),
};

export const StackedBarChartNoTitle: StoryObj<typeof StackedBarChart> = {
  render: () => (
    <StackedBarChart
      title={null}
      data={[
        {
          label: "Q1",
          segments: [
            { label: "Revenue", value: 1200 },
            { label: "Costs", value: 800 },
          ],
        },
        {
          label: "Q2",
          segments: [
            { label: "Revenue", value: 1400 },
            { label: "Costs", value: 850 },
          ],
        },
      ]}
    />
  ),
};

// VerticalBarChart Stories

export const VerticalBarChartBasic: StoryObj<typeof VerticalBarChart> = {
  render: () => (
    <VerticalBarChart
      title="Requests per Hour"
      data={[
        { label: "00", value: 120 },
        { label: "04", value: 45 },
        { label: "08", value: 230 },
        { label: "12", value: 380 },
        { label: "16", value: 420 },
        { label: "20", value: 290 },
      ]}
    />
  ),
};

export const VerticalBarChartWithHighlight: StoryObj<typeof VerticalBarChart> =
  {
    render: () => (
      <VerticalBarChart
        title="Daily Volume (Last 30 Days, 3-Day Buckets)"
        data={[
          { label: "Apr 15-17", value: 18, highlight: 2 },
          { label: "Apr 18-20", value: 22, highlight: 0 },
          { label: "Apr 21-23", value: 17, highlight: 1 },
          { label: "Apr 24-26", value: 25, highlight: 3 },
          { label: "Apr 27-29", value: 21, highlight: 0 },
          { label: "Apr 30-May 2", value: 28, highlight: 4 },
          { label: "May 3-5", value: 24, highlight: 2 },
          { label: "May 6-8", value: 19, highlight: 1 },
          { label: "May 9-11", value: 27, highlight: 3 },
          { label: "May 12-14", value: 23, highlight: 2 },
        ]}
        baseLabel="Traces"
        highlightLabel="Errors"
      />
    ),
  };

// ChartFrame Stories

export const ChartFrameWithTitle: StoryObj<typeof ChartFrame> = {
  render: () => (
    <ChartFrame title="Custom Chart Container">
      <div style={{ padding: "20px", textAlign: "center", color: "#666" }}>
        Chart content goes here
      </div>
    </ChartFrame>
  ),
};

export const ChartFrameWithoutTitle: StoryObj<typeof ChartFrame> = {
  render: () => (
    <ChartFrame title={null}>
      <div style={{ padding: "20px", textAlign: "center", color: "#666" }}>
        Chart without title
      </div>
    </ChartFrame>
  ),
};

// GeneratedUIPlaceholder Stories

export const PlaceholderDefault: StoryObj<typeof GeneratedUIPlaceholder> = {
  render: () => (
    <GeneratedUIPlaceholder message="Generated UI was requested, but no renderable spec was found." />
  ),
};

export const PlaceholderUnsupportedElement: StoryObj<
  typeof GeneratedUIPlaceholder
> = {
  render: () => (
    <GeneratedUIPlaceholder message="Unsupported generated UI element: PieChart" />
  ),
};

export const PlaceholderError: StoryObj<typeof GeneratedUIPlaceholder> = {
  render: () => (
    <GeneratedUIPlaceholder message="Generated UI could not be rendered due to invalid data." />
  ),
};
