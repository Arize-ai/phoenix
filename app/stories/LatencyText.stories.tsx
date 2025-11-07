import { Meta, StoryFn } from "@storybook/react";

import {
  LatencyText,
  LatencyThresholds,
} from "@phoenix/components/trace/LatencyText";

const meta: Meta = {
  title: "Trace/LatencyText",
  component: LatencyText,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    latencyMs: {
      control: { type: "number", min: 0, step: 1 },
      description: "The latency in milliseconds",
    },
    size: {
      control: { type: "select" },
      options: ["S", "M", "L", "XL"],
      description: "The text size",
    },
    showIcon: {
      control: { type: "boolean" },
      description: "Whether to show the clock icon",
    },
  },
};

const latencyThresholds: LatencyThresholds = {
  fast: 3000,
  moderate: 8000,
};

export default meta;

const Template: StoryFn<{
  latencyMs: number;
  size?: "S" | "M" | "L" | "XL";
  showIcon?: boolean;
  latencyThresholds?: LatencyThresholds;
}> = (args) => <LatencyText {...args} />;

/**
 * Default LatencyText component showing moderate latency
 */
export const Default = Template.bind({});
Default.args = {
  latencyMs: 1500,
  size: "M",
  showIcon: true,
  latencyThresholds,
};

/**
 * Fast response under 3 seconds (green color)
 */
export const FastResponse = Template.bind({});
FastResponse.args = {
  latencyMs: 250,
  size: "M",
  showIcon: true,
};

/**
 * Moderate response between 3-8 seconds (yellow color)
 */
export const ModerateResponse = Template.bind({});
ModerateResponse.args = {
  latencyMs: 5000,
  size: "M",
  showIcon: true,
};

/**
 * Slow response between 8-12 seconds (orange color)
 */
export const SlowResponse = Template.bind({});
SlowResponse.args = {
  latencyMs: 10000,
  size: "M",
  showIcon: true,
};

/**
 * Very slow response over 12 seconds (red color)
 */
export const VerySlowResponse = Template.bind({});
VerySlowResponse.args = {
  latencyMs: 15000,
  size: "M",
  showIcon: true,
};

/**
 * Small text size
 */
export const SmallSize = Template.bind({});
SmallSize.args = {
  latencyMs: 2500,
  size: "S",
  showIcon: true,
  latencyThresholds,
};

/**
 * Large text size
 */
export const LargeSize = Template.bind({});
LargeSize.args = {
  latencyMs: 2500,
  size: "L",
  showIcon: true,
  latencyThresholds,
};

/**
 * Extra large text size
 */
export const ExtraLargeSize = Template.bind({});
ExtraLargeSize.args = {
  latencyMs: 2500,
  size: "XL",
  showIcon: true,
  latencyThresholds,
};

/**
 * Latency text displayed without the clock icon
 */
export const WithoutIcon = Template.bind({});
WithoutIcon.args = {
  latencyMs: 3500,
  size: "M",
  showIcon: false,
  latencyThresholds,
};

/**
 * Very fast response under 10ms (displayed in milliseconds)
 */
export const VeryFastMs = Template.bind({});
VeryFastMs.args = {
  latencyMs: 5.7,
  size: "M",
  showIcon: true,
  latencyThresholds,
};

/**
 * Large latency value displayed in seconds
 */
export const LargeLatency = Template.bind({});
LargeLatency.args = {
  latencyMs: 45000,
  size: "M",
  showIcon: true,
  latencyThresholds,
};

/**
 * All color ranges displayed together: green (fast), yellow (moderate), orange (slow), red (very slow)
 */
export const ColorRanges: StoryFn = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
    <LatencyText latencyMs={1000} size="M" showIcon={true} />
    <LatencyText latencyMs={5000} size="M" showIcon={true} />
    <LatencyText latencyMs={10000} size="M" showIcon={true} />
    <LatencyText latencyMs={15000} size="M" showIcon={true} />
  </div>
);
