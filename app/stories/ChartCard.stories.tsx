import { Meta, StoryFn } from "@storybook/react";

import { ChartCard, ChartCardProps } from "@phoenix/components/chart";

const meta: Meta = {
  title: "Charts/ChartCard",
  component: ChartCard,
  parameters: {
    layout: "centered",
  },
};

export default meta;

const Template: StoryFn<ChartCardProps> = (args) => (
  <div style={{ width: "600px", padding: "24px" }}>
    <ChartCard {...args} />
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

/**
 * Default chart card with title and value
 */
export const Default = Template.bind({});
Default.args = {
  title: "Average Order Value",
  value: "$466.67",
  chart: {
    data: sampleData,
    height: 300,
    xAxisLabel: "Month",
    tooltipFormatter: (value: number) => `$${value.toLocaleString()}`,
  },
};

/**
 * Chart card with only a title
 */
export const TitleOnly = Template.bind({});
TitleOnly.args = {
  title: "Monthly Sales",
  chart: {
    data: sampleData,
    height: 300,
    xAxisLabel: "Month",
    yAxisLabel: "Sales",
  },
};

/**
 * Chart card without axis labels
 */
export const NoLabels = Template.bind({});
NoLabels.args = {
  title: "Monthly Sales",
  chart: {
    data: sampleData,
    height: 300,
  },
};

/**
 * Chart card with custom tooltip formatting
 */
export const CustomTooltip = Template.bind({});
CustomTooltip.args = {
  title: "Revenue by Month",
  chart: {
    data: sampleData,
    height: 300,
    xAxisLabel: "Month",
    yAxisLabel: "Revenue ($)",
    tooltipFormatter: (value: number) => `$${value.toLocaleString()}`,
  },
};

/**
 * Chart card with value and menu button
 */
export const WithValueAndMenu = Template.bind({});
WithValueAndMenu.args = {
  title: "Total Revenue",
  value: "$2,800",
  chart: {
    data: sampleData,
    height: 300,
    xAxisLabel: "Month",
    yAxisLabel: "Revenue ($)",
    tooltipFormatter: (value: number) => `$${value.toLocaleString()}`,
  },
  onMenuClick: () => {},
};
