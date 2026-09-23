import type { Meta, StoryObj } from "@storybook/react";

import { SegmentChart, SegmentChartSkeleton } from "@phoenix/components/chart";

/**
 * A single bar split proportionally into colored segments. The building
 * block of every breakdown bar in the app: the token and cost tooltips, the
 * chat token usage, and the breakdown primitives.
 */
const meta = {
  title: "Charts/SegmentChart",
  component: SegmentChart,
  parameters: {
    width: 320,
  },
  tags: ["autodocs"],
  args: {
    height: 8,
    minimumSegmentPercentage: 1,
    segments: [
      {
        name: "Cache read",
        value: 41_600,
        color: "var(--global-color-seafoam-600)",
      },
      {
        name: "Cache write",
        value: 3_120,
        color: "var(--global-color-orange-600)",
      },
      { name: "Input", value: 3_490, color: "var(--global-color-blue-700)" },
      { name: "Output", value: 1_284, color: "var(--global-color-purple-800)" },
    ],
  },
} satisfies Meta<typeof SegmentChart>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Segments fill the bar; a tiny one is held at a minimum width so it shows. */
export const Default: Story = {};

/**
 * A tick under the bar marks a value within the total: here, where the
 * prompt tokens end and the completion tokens begin.
 */
export const WithMarker: Story = {
  args: {
    totalValue: 49_494,
    markerValues: [48_210],
  },
};

/**
 * With a track, segments that add up to less than the total read as a share
 * of a whole. One segment on a track is a meter.
 */
export const WithTrack: Story = {
  args: {
    height: 4,
    showTrack: true,
    totalValue: 49_494,
    segments: [meta.args.segments[0]],
  },
};

/** A track with nothing on it is how a zero share of a whole looks. */
export const EmptyTrack: Story = {
  args: {
    height: 4,
    showTrack: true,
    totalValue: 49_494,
    segments: [{ ...meta.args.segments[0], value: 0 }],
  },
};

/**
 * The chart before its segments load: one skeleton segment on the chart's
 * own geometry, here with the marker lane held open.
 */
export const Loading: Story = {
  render: (args) => (
    <SegmentChartSkeleton height={args.height} showMarkerLane />
  ),
};
