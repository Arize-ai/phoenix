import type { Meta, StoryFn } from "@storybook/react";

import type { LatencyThresholds } from "@phoenix/components/trace/LatencyText";
import { LatencyText } from "@phoenix/components/trace/LatencyText";

const meta: Meta = {
  title: "Trace/Latency Text",
  component: LatencyText,
  parameters: {
    layout: "centered",
    design: {
      type: "figma",
      url: "https://www.figma.com/design/rMddnj6eV2TcQqNkejJ9qX/Core?node-id=569-583",
    },
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

export const Default = {
  args: {
    latencyMs: 1500,
    size: "M",
    showIcon: true,
    latencyThresholds,
  },
};

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
