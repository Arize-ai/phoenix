import type { Meta, StoryFn, StoryObj } from "@storybook/react";

import { Text, Timeline, TimelineItem } from "@phoenix/components";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * An ordered list of items joined by a vertical line. A `Timeline` holds
 * `TimelineItem`s, and each item renders whatever children it is given. The
 * timeline renders no content of its own and sets no width, so its parent
 * sizes it.
 *
 * The indicator is placed for a first line of text at the small line height;
 * it is not measured from the children. Start each item with a line of
 * default-size `Text`, or the indicator will not sit beside it. Set
 * `isTruncated` when the rendered items are not the whole sequence.
 */
const meta: Meta = {
  title: "Design System/Layout/Timeline",
  component: Timeline,
  subcomponents: { TimelineItem },
  tags: ["updated", "unreviewed", "incomplete"],
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
};

export default meta;

const LONG_LINE = "Item 1 with a first line long enough to wrap";

function SampleTimeline({
  itemCount = 3,
  isMultiline = true,
  isLong = false,
  isTruncated,
  isLinked,
  currentIndex,
}: {
  itemCount?: number;
  isMultiline?: boolean;
  isLong?: boolean;
  isTruncated?: boolean;
  isLinked?: boolean;
  currentIndex?: number;
}) {
  return (
    <Timeline isTruncated={isTruncated}>
      {Array.from({ length: itemCount }, (_, index) => {
        const content = (
          <>
            <Text elementType="p">
              {isLong && index === 0 ? LONG_LINE : `Item ${index + 1}`}
            </Text>
            {isMultiline ? (
              <Text elementType="p" size="XS" color="text-700">
                Second line
              </Text>
            ) : null}
          </>
        );
        return isLinked ? (
          <TimelineItem
            key={index}
            to={`#${index}`}
            isCurrent={index === currentIndex}
          >
            {content}
          </TimelineItem>
        ) : (
          <TimelineItem key={index}>{content}</TimelineItem>
        );
      })}
    </Timeline>
  );
}

export const Default: StoryFn = () => (
  <div style={{ width: 280 }}>
    <SampleTimeline />
  </div>
);
Default.tags = ["!dev"];

const TRUNCATION: { label: string; code: true; isTruncated: boolean }[] = [
  { label: "isTruncated=false", code: true, isTruncated: false },
  { label: "isTruncated=true", code: true, isTruncated: true },
];

export const Truncation: StoryFn = () => (
  <OptionGrid
    rows={[{ label: "Three items" }]}
    columns={TRUNCATION}
    cellWidth="200px"
    alignRows="start"
    renderCell={(_row, truncation) => (
      <SampleTimeline isTruncated={truncation?.isTruncated} />
    )}
  />
);
Truncation.tags = ["!dev"];
Truncation.parameters = { themeLayout: "column" };

const LENGTHS: { label: string; isLong: boolean }[] = [
  { label: "Short", isLong: false },
  { label: "Long", isLong: true },
];

const LINES: { label: string; isMultiline: boolean }[] = [
  { label: "One line", isMultiline: false },
  { label: "Two lines", isMultiline: true },
];

export const LinesAndLength: StoryFn = () => (
  <OptionGrid
    rows={LENGTHS}
    columns={LINES}
    cellWidth="200px"
    alignRows="start"
    renderCell={(length, lines) => (
      <SampleTimeline isLong={length.isLong} isMultiline={lines?.isMultiline} />
    )}
  />
);
LinesAndLength.tags = ["!dev"];
LinesAndLength.parameters = { themeLayout: "column" };

const LINKS: {
  label: string;
  isLinked: boolean;
  currentIndex?: number;
}[] = [
  { label: "Not linked", isLinked: false },
  { label: "Linked", isLinked: true },
  { label: "Linked, one current", isLinked: true, currentIndex: 1 },
];

/**
 * With a `to`, the whole item is one link with a hover state, and
 * `isCurrent` marks the item for the page currently shown.
 */
export const Links: StoryFn = () => (
  <OptionGrid
    rows={[{ label: "Three items" }]}
    columns={LINKS}
    cellWidth="200px"
    alignRows="start"
    renderCell={(_row, link) => (
      <SampleTimeline
        isLinked={link?.isLinked}
        currentIndex={link?.currentIndex}
      />
    )}
  />
);
Links.tags = ["!dev"];
Links.parameters = { themeLayout: "column" };

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <div style={{ width: 280 }}>
      <SampleTimeline isTruncated />
    </div>
  ),
};
