import type { Meta, StoryObj } from "@storybook/react";

import {
  SpanEventsListContent,
  type SpanEvent,
} from "@phoenix/pages/trace/SpanEventsList";

import {
  DetailPanelExample,
  DetailPanelExamples,
} from "./detailPanelStoryHelpers";

const okEvent: SpanEvent = {
  name: "cache.hit",
  message: "Retrieved a cached completion",
  timestamp: "2026-07-23T16:00:00.125Z",
  attributes: { cacheKey: "completion:4c92", ageMs: 842 },
};

const errorEvent: SpanEvent = {
  name: "exception",
  message: "Connection pool exhausted",
  timestamp: "2026-07-23T16:00:01.250Z",
  attributes: {
    "exception.type": "DatabaseConnectionError",
    "exception.escaped": false,
    "exception.stacktrace":
      "DatabaseConnectionError: connection pool exhausted",
  },
};

const mixedEvents: SpanEvent[] = [
  okEvent,
  {
    name: "retry.scheduled",
    message: "Retrying after 250 ms",
    timestamp: "2026-07-23T16:00:01.500Z",
    attributes: { attempt: 2, delayMs: 250 },
  },
  errorEvent,
  {
    name: "request.completed",
    message: "Retry completed successfully",
    timestamp: "2026-07-23T16:00:02.100Z",
    attributes: {},
  },
];

function getSillyNumberOfEvents(): SpanEvent[] {
  return Array.from({ length: 30 }, (_, index) => {
    const isError = index % 4 === 3;
    return {
      name: isError ? "exception" : `pipeline.step.${index + 1}.completed`,
      message: isError
        ? `Synthetic failure ${index + 1}`
        : `Synthetic success ${index + 1}`,
      timestamp: new Date(
        Date.parse("2026-07-23T16:00:00.000Z") + index * 137
      ).toISOString(),
      attributes: { index, isSynthetic: true },
    };
  });
}

const meta = {
  title: "Detail panel/Events",
  component: SpanEventsListContent,
  parameters: {
    width: "fill",
  },
} satisfies Meta<typeof SpanEventsListContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Permutations: Story = {
  args: { events: mixedEvents },
  render: () => (
    <DetailPanelExamples>
      <DetailPanelExample title="Empty">
        <SpanEventsListContent events={[]} />
      </DetailPanelExample>
      <DetailPanelExample title="One OK event">
        <SpanEventsListContent events={[okEvent]} />
      </DetailPanelExample>
      <DetailPanelExample title="One error event">
        <SpanEventsListContent events={[errorEvent]} />
      </DetailPanelExample>
      <DetailPanelExample title="Mixed OK and error events">
        <SpanEventsListContent events={mixedEvents} />
      </DetailPanelExample>
      <DetailPanelExample title="A silly number of OK and error events">
        <SpanEventsListContent events={getSillyNumberOfEvents()} />
      </DetailPanelExample>
    </DetailPanelExamples>
  ),
  tags: ["!dev"],
};
