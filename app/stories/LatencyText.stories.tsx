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
 * All color ranges displayed together: green (fast), yellow (moderate), red (slow)
 */
export const ColorRanges: StoryFn = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
    <LatencyText
      latencyMs={1000}
      size="M"
      showIcon={true}
      latencyThresholds={latencyThresholds}
    />
    <LatencyText
      latencyMs={5000}
      size="M"
      showIcon={true}
      latencyThresholds={latencyThresholds}
    />
    <LatencyText
      latencyMs={10000}
      size="M"
      showIcon={true}
      latencyThresholds={latencyThresholds}
    />
    <LatencyText
      latencyMs={15000}
      size="M"
      showIcon={true}
      latencyThresholds={latencyThresholds}
    />
  </div>
);
