import type { Meta, StoryFn, StoryObj } from "@storybook/react";

import {
  Text,
  Timeline,
  TimelineContent,
  TimelineHeader,
  TimelineItem,
} from "@phoenix/components";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * A vertical sequence of events, newest first, such as a prompt's latest
 * versions. Set `isTruncated` when older events exist beyond the rendered
 * ones: the last separator then fades out rather than ending.
 */
const meta: Meta = {
  title: "Design System/Layout/Timeline",
  component: Timeline,
  subcomponents: { TimelineItem, TimelineHeader, TimelineContent },
  tags: ["updated", "unreviewed", "complete"],
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
};

export default meta;

type Event = { title: string; description?: string };

const VERSIONS: Event[] = [
  { title: "Version 4", description: "Lower temperature to 0.2" },
  { title: "Version 3", description: "Add a JSON output schema" },
  { title: "Version 2", description: "Tighten the system prompt" },
];

function EventTimeline({
  events,
  isTruncated,
}: {
  events: Event[];
  isTruncated?: boolean;
}) {
  return (
    <Timeline isTruncated={isTruncated}>
      {events.map((event) => (
        <TimelineItem key={event.title}>
          <TimelineHeader>
            <Text>{event.title}</Text>
          </TimelineHeader>
          {event.description ? (
            <TimelineContent>
              <Text size="XS" color="text-700">
                {event.description}
              </Text>
            </TimelineContent>
          ) : null}
        </TimelineItem>
      ))}
    </Timeline>
  );
}

const TRUNCATION: { label: string; code: true; isTruncated: boolean }[] = [
  { label: "isTruncated=false", code: true, isTruncated: false },
  { label: "isTruncated=true", code: true, isTruncated: true },
];

const CONTENT: { label: string; events: Event[] }[] = [
  { label: "One item", events: VERSIONS.slice(0, 1) },
  { label: "Several items", events: VERSIONS },
  {
    label: "Header only",
    events: VERSIONS.map(({ title }) => ({ title })),
  },
  {
    label: "Long header",
    events: [
      {
        title:
          "Version 4 — switch to the structured output format and rename the inputs",
        description: "Lower temperature to 0.2",
      },
      ...VERSIONS.slice(1),
    ],
  },
];

export const Default: StoryFn = () => (
  <div style={{ width: 280 }}>
    <EventTimeline events={VERSIONS} />
  </div>
);
Default.tags = ["!dev"];

export const TruncationAndContent: StoryFn = () => (
  <OptionGrid
    rows={TRUNCATION}
    columns={CONTENT}
    cellWidth="200px"
    alignRows="start"
    renderCell={(row, content) => (
      <EventTimeline
        events={content?.events ?? []}
        isTruncated={row.isTruncated}
      />
    )}
  />
);
TruncationAndContent.tags = ["!dev"];
TruncationAndContent.parameters = { themeLayout: "column" };

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <div style={{ width: 280 }}>
      <EventTimeline events={VERSIONS} isTruncated />
    </div>
  ),
};
