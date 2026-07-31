import type { Meta, StoryObj } from "@storybook/react";
import { useId } from "react";
import { RelayEnvironmentProvider } from "react-relay";
import { Environment, Network, RecordSource, Store } from "relay-runtime";

import { SpanInfo } from "@phoenix/pages/trace/span";
import type {
  SpanInfoData,
  SpanInfoSectionIds,
} from "@phoenix/pages/trace/span";
import { SpanInfoCardsProvider } from "@phoenix/pages/trace/SpanInfoCardsContext";

import {
  createSpanInfoFixture,
  DetailPanelExample,
  DetailPanelExamples,
} from "./detailPanelStoryHelpers";

const mockRelayEnvironment = new Environment({
  network: Network.create(async () => ({ data: {} })),
  store: new Store(new RecordSource()),
});

const genericSpan = createSpanInfoFixture({
  spanKind: "chain",
  input: { mimeType: "text", value: "Summarize the selected trace." },
  output: { mimeType: "text", value: "The trace completed successfully." },
  attributes: JSON.stringify({
    metadata: { environment: "production", region: "us-west-2" },
  }),
});

const llmMessagesSpan = createSpanInfoFixture({
  spanKind: "llm",
  attributes: JSON.stringify({
    llm: {
      provider: "openai",
      model_name: "gpt-4.1",
      prompt_template: {
        template: "Answer the question: {{question}}",
        variables: { question: "What changed?" },
      },
      invocation_parameters: JSON.stringify({ temperature: 0.2 }),
      input_messages: [
        { message: { role: "system", content: "Answer concisely." } },
        { message: { role: "user", content: "What changed?" } },
        {
          message: {
            role: "assistant",
            content: "I will inspect the deployment.",
          },
        },
        {
          message: {
            role: "tool",
            name: "deployment_status",
            tool_call_id: "call_001",
            content: '{"status":"healthy"}',
          },
        },
      ],
      output_messages: [
        {
          message: {
            role: "assistant",
            content: "The deployment is healthy.",
            tool_calls: [
              {
                tool_call: {
                  id: "call_002",
                  function: {
                    name: "deployment_status",
                    arguments: '{"service":"api"}',
                  },
                },
              },
            ],
          },
        },
      ],
    },
  }),
});

const llmPromptsSpan = createSpanInfoFixture({
  spanKind: "llm",
  attributes: JSON.stringify({
    llm: {
      prompts: ["Summarize the incident timeline."],
    },
  }),
});

const llmToolDefinitionsSpan = createSpanInfoFixture({
  spanKind: "llm",
  attributes: JSON.stringify({
    llm: {
      input_messages: [
        { message: { role: "user", content: "Check the deployment." } },
      ],
      tools: [
        {
          tool: {
            json_schema: JSON.stringify({
              type: "function",
              function: {
                name: "deployment_status",
                description: "Returns the current deployment status.",
                parameters: {
                  type: "object",
                  properties: { service: { type: "string" } },
                  required: ["service"],
                },
              },
            }),
          },
        },
      ],
    },
  }),
});

const retrieverSpan = createSpanInfoFixture({
  spanKind: "retriever",
  input: { mimeType: "text", value: "Phoenix persistence" },
  attributes: JSON.stringify({
    retrieval: {
      documents: [
        {
          document: {
            id: "document-001",
            content: "Phoenix can persist data in SQLite or PostgreSQL.",
            score: 0.96,
            metadata: { source: "deployment guide" },
          },
        },
      ],
    },
  }),
  documentRetrievalMetrics: [
    { evaluationName: "retrieval quality", hit: 1, ndcg: 0.94, precision: 1 },
  ],
});

const rerankerSpan = createSpanInfoFixture({
  spanKind: "reranker",
  attributes: JSON.stringify({
    reranker: {
      query: "Phoenix persistence",
      input_documents: [
        {
          document: {
            id: "candidate-001",
            content: "Candidate deployment documentation.",
            score: 0.72,
          },
        },
      ],
      output_documents: [
        {
          document: {
            id: "ranked-001",
            content: "Ranked persistence documentation.",
            score: 0.98,
          },
        },
      ],
    },
  }),
});

const embeddingSpan = createSpanInfoFixture({
  spanKind: "embedding",
  attributes: JSON.stringify({
    embedding: {
      embeddings: [
        {
          embedding: {
            text: "Phoenix stores traces and evaluation data.",
          },
        },
      ],
    },
  }),
});

const toolSpan = createSpanInfoFixture({
  spanKind: "tool",
  input: { mimeType: "json", value: '{"service":"api"}' },
  output: { mimeType: "json", value: '{"status":"healthy"}' },
  attributes: JSON.stringify({
    tool: {
      name: "deployment_status",
      description: "Returns the current deployment status.",
      parameters: JSON.stringify({
        type: "object",
        properties: { service: { type: "string" } },
        required: ["service"],
      }),
    },
  }),
});

const unparsableSpan = createSpanInfoFixture({
  spanKind: "chain",
  attributes: "not valid JSON",
});

const currentPresentations: ReadonlyArray<{
  title: string;
  description: string;
  span: SpanInfoData;
}> = [
  {
    title: "Generic span · raw input, raw output, and metadata",
    description:
      "Prompt-style input surface followed by unframed output and metadata section bodies.",
    span: genericSpan,
  },
  {
    title: "LLM · message roles, prompt template, and invocation parameters",
    description:
      "Neutral nested message cards for every role, plus the two collapsed context cards.",
    span: llmMessagesSpan,
  },
  {
    title: "LLM · raw prompt",
    description:
      "The remaining gray prompt card inside the flat Input section.",
    span: llmPromptsSpan,
  },
  {
    title: "LLM · tool definition",
    description:
      "A neutral tool card inside the flat Tool Definitions section.",
    span: llmToolDefinitionsSpan,
  },
  {
    title: "Retriever · query, retrieval metrics, and document",
    description:
      "Prompt-style query input, flat metrics, and a neutral document card.",
    span: retrieverSpan,
  },
  {
    title: "Reranker · query and neutral documents",
    description:
      "Nested query/document disclosures with a neutral output document card.",
    span: rerankerSpan,
  },
  {
    title: "Embedding · embedded text",
    description: "A neutral Embedded Text card inside the flat Input section.",
    span: embeddingSpan,
  },
  {
    title: "Tool span · raw input, raw output, and definition fields",
    description:
      "Prompt-style input, unframed output, and a flat Tool Definitions body.",
    span: toolSpan,
  },
  {
    title: "Invalid attributes",
    description:
      "The warning presentation used when attributes cannot be parsed.",
    span: unparsableSpan,
  },
];

const storySectionIds: SpanInfoSectionIds = {
  input: "story-input",
  output: "story-output",
  toolDefinitions: "story-tool-definitions",
  metadata: "story-metadata",
};

function SpanInfoPresentation({ span }: { span: SpanInfoData }) {
  const sectionIdPrefix = useId().replaceAll(":", "");
  const sectionIds: SpanInfoSectionIds = {
    input: `${sectionIdPrefix}-input`,
    output: `${sectionIdPrefix}-output`,
    toolDefinitions: `${sectionIdPrefix}-tool-definitions`,
    metadata: `${sectionIdPrefix}-metadata`,
  };

  return (
    <SpanInfoCardsProvider>
      <SpanInfo span={span} sectionIds={sectionIds} />
    </SpanInfoCardsProvider>
  );
}

const meta = {
  title: "Detail panel/Span presentation inventory",
  component: SpanInfo,
  decorators: [
    (Story) => (
      <RelayEnvironmentProvider environment={mockRelayEnvironment}>
        <Story />
      </RelayEnvironmentProvider>
    ),
  ],
  parameters: {
    controls: { disable: true },
    themeLayout: "row",
    width: 640,
  },
} satisfies Meta<typeof SpanInfo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllCurrentPresentations: Story = {
  args: { span: genericSpan, sectionIds: storySectionIds },
  render: () => (
    <DetailPanelExamples>
      {currentPresentations.map(({ title, description, span }) => (
        <DetailPanelExample key={title} title={title} description={description}>
          <SpanInfoPresentation span={span} />
        </DetailPanelExample>
      ))}
    </DetailPanelExamples>
  ),
};
