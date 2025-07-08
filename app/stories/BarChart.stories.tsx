import { Meta, StoryFn } from "@storybook/react";

import { BarChart, BarChartProps } from "@phoenix/components/chart";

const meta: Meta = {
  title: "Charts/BarChart",
  component: BarChart,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    data: {
      control: "object",
    },
    height: {
      control: { type: "range", min: 200, max: 600, step: 50 },
    },
    showGrid: {
      control: "boolean",
    },
    showTooltip: {
      control: "boolean",
    },
    xAxisKey: {
      control: "text",
    },
    yAxisKey: {
      control: "text",
    },
    xAxisLabel: {
      control: "text",
    },
    yAxisLabel: {
      control: "text",
    },
    barSize: {
      control: { type: "select", options: ["auto", "sm", "md", "lg"] },
    },
  },
};

export default meta;

const Template: StoryFn<BarChartProps> = (args) => (
  <div style={{ width: "600px", height: "400px" }}>
    <BarChart {...args} />
  </div>
);

const sampleData = [
  { name: "Jan", value: 400 },
  { name: "Feb", value: 300 },
  { name: "Mar", value: 500 },
  { name: "Apr", value: 200 },
  { name: "May", value: 600 },
  { name: "Jun", value: 400 },
];

export const Default = Template.bind({});
Default.args = {
  data: sampleData,
  height: 300,
  xAxisLabel: "Month",
  yAxisLabel: "Value",
};

export const SmallBars = Template.bind({});
SmallBars.args = {
  data: sampleData,
  height: 300,
  barSize: "sm",
  xAxisLabel: "Month",
  yAxisLabel: "Value",
};

export const MediumBars = Template.bind({});
MediumBars.args = {
  data: sampleData,
  height: 300,
  barSize: "md",
  xAxisLabel: "Month",
  yAxisLabel: "Value",
};

export const LargeBars = Template.bind({});
LargeBars.args = {
  data: sampleData,
  height: 300,
  barSize: "lg",
  xAxisLabel: "Month",
  yAxisLabel: "Value",
};

export const CustomTooltip = Template.bind({});
CustomTooltip.args = {
  data: sampleData,
  height: 300,
  tooltipFormatter: (value: number, name: string) => `${name}: ${value} units`,
  xAxisLabel: "Month",
  yAxisLabel: "Value",
};

export const CustomDataKeys = Template.bind({});
CustomDataKeys.args = {
  data: [
    { name: "January", value: 120, month: "January", count: 120 },
    { name: "February", value: 190, month: "February", count: 190 },
    { name: "March", value: 300, month: "March", count: 300 },
    { name: "April", value: 500, month: "April", count: 500 },
    { name: "May", value: 200, month: "May", count: 200 },
  ],
  xAxisKey: "month",
  yAxisKey: "count",
  height: 300,
  xAxisLabel: "Month",
  yAxisLabel: "Count",
};

export const NoTooltip = Template.bind({});
NoTooltip.args = {
  data: sampleData,
  height: 300,
  showTooltip: false,
  xAxisLabel: "Month",
  yAxisLabel: "Value",
};

export const NoGridOrAxisLabel = Template.bind({});
NoGridOrAxisLabel.args = {
  data: sampleData,
  height: 300,
  showGrid: false,
};
