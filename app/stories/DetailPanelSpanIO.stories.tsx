import type { Meta, StoryObj } from "@storybook/react";

import { SpanIO } from "@phoenix/pages/trace/SpanDetails";

import {
  createSpanInfoFixture,
  DetailPanelExample,
  DetailPanelExamples,
} from "./detailPanelStoryHelpers";

const emptySpan = createSpanInfoFixture({
  attributes: JSON.stringify({ "openinference.span.kind": "CHAIN" }),
});
const inputOnlySpan = createSpanInfoFixture({
  input: { mimeType: "text", value: "Explain why the sky appears blue." },
});
const outputOnlySpan = createSpanInfoFixture({
  output: {
    mimeType: "json",
    value: JSON.stringify(
      { answer: "Rayleigh scattering", confidence: 0.98 },
      null,
      2
    ),
  },
});
const inputAndOutputSpan = createSpanInfoFixture({
  input: {
    mimeType: "json",
    value: JSON.stringify({ query: "active users", range: "7d" }, null, 2),
  },
  output: {
    mimeType: "text",
    value: "There were **12,481** active users in the last seven days.",
  },
});

const MODERATELY_LONG_JSON = JSON.stringify(
  {
    requestId: "req_01J3J8N6T7CX9QV2F5B4K1M0PZ",
    account: { id: "acct_enterprise_1042", region: "us-west-2" },
    query: {
      metric: "request_latency_ms",
      services: ["api-gateway", "orchestrator", "model-runtime"],
      window: { start: "2026-07-23T15:00:00Z", end: "2026-07-23T16:00:00Z" },
      groupBy: ["service", "deployment", "status_code"],
    },
    filters: Array.from({ length: 12 }, (_unused, filterIndex) => ({
      field: `resource.attribute.${filterIndex}`,
      operator: filterIndex % 2 === 0 ? "equals" : "contains",
      value: `production-value-${filterIndex}`,
    })),
  },
  null,
  2
);

const EXTREMELY_LONG_JSON = JSON.stringify(
  {
    requestId: "req_01J3J8N6T7CX9QV2F5B4K1M0PZ",
    status: "completed_with_partial_failures",
    records: Array.from({ length: 120 }, (_unused, recordIndex) => ({
      id: `record-${String(recordIndex + 1).padStart(4, "0")}`,
      timestamp: new Date(
        Date.parse("2026-07-23T16:00:00.000Z") + recordIndex * 137
      ).toISOString(),
      service: ["api-gateway", "orchestrator", "retrieval", "model-runtime"][
        recordIndex % 4
      ],
      deployment: `production-${(recordIndex % 7) + 1}`,
      latencyMs: 80 + recordIndex * 17,
      status: recordIndex % 11 === 0 ? "error" : "ok",
      attributes: {
        traceId: recordIndex.toString(16).padStart(32, "0"),
        spanId: recordIndex.toString(16).padStart(16, "0"),
        retries: recordIndex % 3,
        cache: recordIndex % 5 === 0 ? "hit" : "miss",
      },
    })),
  },
  null,
  2
);

const longJsonSpan = createSpanInfoFixture({
  input: { mimeType: "json", value: MODERATELY_LONG_JSON },
  output: { mimeType: "json", value: EXTREMELY_LONG_JSON },
});

const meta = {
  title: "Detail panel/Span IO",
  component: SpanIO,
  parameters: {
    width: "fill",
  },
} satisfies Meta<typeof SpanIO>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Permutations: Story = {
  args: { span: inputAndOutputSpan },
  render: () => (
    <DetailPanelExamples>
      <DetailPanelExample title="No input or output">
        <SpanIO span={emptySpan} />
      </DetailPanelExample>
      <DetailPanelExample title="Text input only">
        <SpanIO span={inputOnlySpan} />
      </DetailPanelExample>
      <DetailPanelExample title="JSON output only">
        <SpanIO span={outputOnlySpan} />
      </DetailPanelExample>
      <DetailPanelExample title="JSON input and text output">
        <SpanIO span={inputAndOutputSpan} />
      </DetailPanelExample>
      <DetailPanelExample title="Moderately long input and extremely long output JSON">
        <SpanIO span={longJsonSpan} />
      </DetailPanelExample>
    </DetailPanelExamples>
  ),
  tags: ["!dev"],
};
