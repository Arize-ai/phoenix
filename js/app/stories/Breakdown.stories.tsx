import type { Meta, StoryObj } from "@storybook/react";

import { Divider, Flex } from "@phoenix/components";
import type {
  BreakdownDimension,
  BreakdownSegment,
} from "@phoenix/components/chart";
import {
  BreakdownBars,
  BreakdownBarsSkeleton,
  BreakdownTable,
  BreakdownTableSkeleton,
  useCategoryChartColors,
} from "@phoenix/components/chart";
import { formatInt } from "@phoenix/utils/numberFormatUtils";

const formatGigabytes = (bytes: number) => `${(bytes / 1e9).toFixed(1)} GB`;

/**
 * A breakdown is one whole measured in several dimensions and split, in
 * each, into the same segments. `BreakdownBars` draws one bar per
 * dimension, so a segment's share can be read down the bars and compared
 * from one measure to the next. `BreakdownTable` is its legend: one row per
 * segment with its value and share in every dimension. Both draw the same
 * segments in the same colors, so a segment can be followed from bar to bar
 * and from bar to row.
 *
 * Each bar is a `SegmentChart`. Reach for a `SegmentChart` on its own when
 * there is one quantity to divide and nothing to compare it against; reach
 * for the breakdown when there are two or more dimensions and the point is
 * how the split differs between them.
 *
 * The token and cost tooltips compose these under a heading. This story
 * breaks a dataset's attachments down by kind, to show the primitives are
 * indifferent to what is being measured.
 */
const meta = {
  title: "Charts/Breakdown",
  parameters: {
    width: 360,
    controls: { disable: true },
  },
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function useAttachmentSegments(): BreakdownSegment[] {
  const colors = useCategoryChartColors();
  return [
    { key: "image", label: "Images", color: colors.category1 },
    { key: "audio", label: "Audio", color: colors.category3 },
    { key: "pdf", label: "PDFs", color: colors.category7 },
    { key: "text", label: "Text", color: colors.category2 },
  ];
}

const count: BreakdownDimension = {
  key: "count",
  label: "Files",
  total: 1_240,
  values: { image: 860, audio: 40, pdf: 120, text: 220 },
  formatter: formatInt,
  // Where the media end and the documents begin
  markerValues: [900],
};

const size: BreakdownDimension = {
  key: "size",
  label: "Size",
  total: 6.4e9,
  values: { image: 2.1e9, audio: 3.6e9, pdf: 6.0e8, text: 1.0e8 },
  formatter: formatGigabytes,
  markerValues: [5.7e9],
};

function Example({ dimensions }: { dimensions: BreakdownDimension[] }) {
  const segments = useAttachmentSegments();
  return (
    <Flex direction="column" gap="size-150">
      <BreakdownBars segments={segments} dimensions={dimensions} />
      <Divider />
      <BreakdownTable segments={segments} dimensions={dimensions} />
    </Flex>
  );
}

/** The bars and the table together, as the token tooltips compose them. */
export const BarsAndTable: Story = {
  render: () => <Example dimensions={[count, size]} />,
};

/** A single dimension: one bar, and a table with one measure column. */
export const OneDimension: Story = {
  render: () => <Example dimensions={[count]} />,
};

/**
 * A dimension that measured none of the segments draws as one neutral bar
 * of its total, and its cells show dashes over empty tracks.
 */
export const UnmeasuredDimension: Story = {
  render: () => (
    <Example
      dimensions={[count, { ...size, values: {}, markerValues: undefined }]}
    />
  ),
};

/**
 * The bars and the table while the segments load. Each dimension keeps its
 * label and total; the bars, and the table's swatches, names, values and
 * shares, are skeletons on the same grid, so the loaded breakdown takes the
 * same room apart from the number of rows.
 */
export const Loading: Story = {
  render: () => {
    const dimensions = [count, size].map((dimension) => ({
      key: dimension.key,
      label: dimension.label,
      total: dimension.formatter(dimension.total),
    }));
    return (
      <Flex direction="column" gap="size-150">
        <BreakdownBarsSkeleton dimensions={dimensions} />
        <Divider />
        <BreakdownTableSkeleton dimensions={dimensions} rows={4} />
      </Flex>
    );
  },
};
