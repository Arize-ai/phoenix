import type { Meta, StoryObj } from "@storybook/react";

import { SpanAttributes } from "@phoenix/pages/trace/SpanDetails";

import {
  DetailPanelExample,
  DetailPanelExamples,
} from "./detailPanelStoryHelpers";

const shortAttributes = JSON.stringify(
  {
    "openinference.span.kind": "LLM",
    "llm.model_name": "gpt-4.1-mini",
  },
  null,
  2
);

const longAttributes = JSON.stringify(
  {
    "openinference.span.kind": "LLM",
    llm: {
      provider: "openai",
      model_name: "gpt-4.1",
      token_count: { prompt: 1248, completion: 483, total: 1731 },
      invocation_parameters: {
        temperature: 0.2,
        max_tokens: 2048,
        response_format: { type: "json_schema" },
      },
    },
    session: { id: "session-74ce77" },
    user: { id: "user-2048", role: "analyst" },
    tags: ["production", "customer-facing", "priority"],
    metadata: {
      deployment: { environment: "production", region: "us-west-2" },
      request: { retry: 2, cached: false, featureFlags: ["rag", "tools"] },
    },
  },
  null,
  2
);

const trashFireAttributes = JSON.stringify(
  {
    "openinference.span.kind": "LLM",
    "llm.model_name": "gpt-4.1",
    "llm.invocation_parameters": JSON.stringify({
      temperature: 0.2,
      response_format: JSON.stringify({
        type: "json_schema",
        json_schema: JSON.stringify({
          name: "incident_summary",
          schema: JSON.stringify({
            type: "object",
            properties: JSON.stringify({
              summary: { type: "string" },
              affected_services: {
                type: "array",
                items: JSON.stringify({ type: "string" }),
              },
            }),
          }),
        }),
      }),
      vendor_options: JSON.stringify({
        retry: JSON.stringify({
          attempts: 3,
          backoff: JSON.stringify({ strategy: "exponential", jitter: true }),
        }),
      }),
    }),
    "llm.input_messages": JSON.stringify([
      {
        message: JSON.stringify({
          role: "user",
          content: JSON.stringify({
            type: "text",
            value: "Why is the checkout service returning 503s?",
            context: JSON.stringify({
              request: JSON.stringify({
                headers: JSON.stringify({
                  "x-forwarded-for": "203.0.113.42",
                  "x-request-id": "req_01J3J8N6T7CX9QV2F5B4K1M0PZ",
                }),
                body: JSON.stringify({
                  tenant: "enterprise-1042",
                  filters: JSON.stringify({
                    regions: ["us-west-2", "us-east-1"],
                  }),
                }),
              }),
            }),
          }),
        }),
      },
    ]),
    metadata: JSON.stringify({
      workflow: "incident-triage",
      baggage: JSON.stringify({
        upstream: JSON.stringify({
          response: JSON.stringify({
            status: 503,
            body: JSON.stringify({
              error: "connection pool exhausted",
              details: JSON.stringify({
                database: "checkout-primary",
                replicas: JSON.stringify([
                  { region: "us-west-2", state: "saturated" },
                  { region: "us-east-1", state: "lagging" },
                ]),
              }),
            }),
          }),
        }),
      }),
    }),
  },
  null,
  2
);

const meta = {
  title: "Detail panel/Attributes",
  component: SpanAttributes,
  parameters: {
    width: "fill",
  },
} satisfies Meta<typeof SpanAttributes>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Permutations: Story = {
  args: { attributes: shortAttributes },
  render: () => (
    <DetailPanelExamples>
      <DetailPanelExample title="Empty object">
        <SpanAttributes attributes="{}" />
      </DetailPanelExample>
      <DetailPanelExample title="Short and flat">
        <SpanAttributes attributes={shortAttributes} />
      </DetailPanelExample>
      <DetailPanelExample title="Long and neat">
        <SpanAttributes attributes={longAttributes} />
      </DetailPanelExample>
      <DetailPanelExample
        title="Stringified JSON trash fire"
        description="Valid outer JSON whose values contain several more layers of stringified JSON."
      >
        <SpanAttributes attributes={trashFireAttributes} />
      </DetailPanelExample>
      <DetailPanelExample
        title="Malformed payload"
        description="The production fallback displays the original value when attributes are not valid JSON."
      >
        <SpanAttributes attributes={'{"valid": true, "truncated":'} />
      </DetailPanelExample>
    </DetailPanelExamples>
  ),
  tags: ["!dev"],
};
