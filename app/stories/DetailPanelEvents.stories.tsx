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

const allOpenMixedEvents: SpanEvent[] = [
  {
    ...okEvent,
    attributes: {
      cacheKey: "completion:4c92",
      ageMs: 842,
      lookup: {
        namespace: "production/completions/v3/enterprise-1042",
        cacheKey:
          "completion:incident-triage:enterprise-1042:production:us-west-2:4c92b9917a",
        policy: JSON.stringify({
          ttlSeconds: 900,
          staleWhileRevalidateSeconds: 120,
          vary: ["tenant", "model", "response_format", "tool_catalog_hash"],
        }),
      },
    },
  },
  {
    name: "retry.scheduled",
    message: "Retrying after 250 ms",
    timestamp: "2026-07-23T16:00:01.500Z",
    attributes: {
      attempt: 2,
      delayMs: 250,
      retryPolicy: JSON.stringify({
        strategy: "decorrelated_jitter",
        retryableStatusCodes: [408, 429, 500, 502, 503, 504],
        regionalFailover: {
          attempted: ["us-west-2a", "us-west-2b"],
          next: "us-east-1a",
        },
      }),
    },
  },
  {
    ...errorEvent,
    attributes: {
      "exception.type": "DatabaseConnectionError",
      "exception.escaped": false,
      "exception.stacktrace": [
        "DatabaseConnectionError: connection pool exhausted",
        "    at acquireConnection (/srv/checkout/db/pool.ts:184:17)",
        "    at processCheckout (/srv/checkout/routes/checkout.ts:92:31)",
        "    at async traceMiddleware (/srv/observability/middleware.ts:48:9)",
      ].join("\n"),
      "diagnostic.snapshot": JSON.stringify({
        pool: { configured: 120, active: 120, idle: 0, waiting: 847 },
        deployment: {
          image: "checkout-api:2026.07.23-rc4",
          rolloutPercent: 35,
          commit: "ea87d065312bfc17f45b874a5eeec7ef103c2f3a",
        },
      }),
    },
  },
  {
    name: "request.completed",
    message: "Retry completed successfully",
    timestamp: "2026-07-23T16:00:02.100Z",
    attributes: {
      statusCode: 200,
      elapsedMs: 2100,
      responseMetadata: JSON.stringify({
        requestId: "req_01J3J8N6T7CX9QV2F5B4K1M0PZ",
        servingPath: ["edge-17", "api-gateway-3", "checkout-api-rc4-7c9d8"],
        headers: {
          "x-ratelimit-limit-requests": "10000",
          "x-ratelimit-remaining-requests": "9983",
          "x-ratelimit-reset-requests": "1.842s",
        },
      }),
    },
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
      <DetailPanelExample title="Mixed OK and error events · all open">
        <SpanEventsListContent
          events={allOpenMixedEvents}
          defaultExpandedKeys={allOpenMixedEvents.map((_event, index) => index)}
        />
      </DetailPanelExample>
      <DetailPanelExample title="A silly number of OK and error events">
        <SpanEventsListContent events={getSillyNumberOfEvents()} />
      </DetailPanelExample>
    </DetailPanelExamples>
  ),
  tags: ["!dev"],
};
