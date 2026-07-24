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
      <DetailPanelExample title="Long and nested">
        <SpanAttributes attributes={longAttributes} />
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
