import type { Meta, StoryObj } from "@storybook/react";
import { RelayEnvironmentProvider } from "react-relay";
import { Environment, Network, RecordSource, Store } from "relay-runtime";

import { SpanInfo } from "@phoenix/pages/trace/span";

import {
  chainJsonIOSpan,
  chainTextIOSpan,
  embeddingSpan,
  embeddingWithoutEmbeddingsSpan,
  llmChatSpan,
  llmErrorSpan,
  llmMultiModalSpan,
  llmPromptTemplateSpan,
  llmToolCallsSpan,
  llmToolDefinitionsSpan,
  rerankerSpan,
  retrieverSpan,
  spanWithoutIOSpan,
  toolBashSpan,
  toolSpan,
  unparsableAttributesSpan,
} from "./constants/spanInfoFixtures";

/**
 * Document annotation components mount Relay mutation hooks, so the stories
 * provide a no-op Relay environment. No network requests are made.
 */
const mockRelayEnvironment = new Environment({
  network: Network.create(async () => ({ data: {} })),
  store: new Store(new RecordSource()),
});

/**
 * `SpanInfo` is the main body of the span details view. It parses the span's
 * attributes and renders the composition for the span's kind — each story is
 * a realistic span captured from Phoenix demo data (llama-index RAG,
 * LangGraph agents, Claude Code traces).
 */
const meta: Meta<typeof SpanInfo> = {
  title: "Trace/SpanInfo",
  component: SpanInfo,
  decorators: [
    (Story) => (
      <RelayEnvironmentProvider environment={mockRelayEnvironment}>
        <Story />
      </RelayEnvironmentProvider>
    ),
  ],
  parameters: {
    width: 900,
    controls: { disable: true },
  },
};

export default meta;

type Story = StoryObj<typeof SpanInfo>;

/**
 * A chat completion: system + user input messages, an assistant output
 * message, and invocation parameters.
 */
export const LLMChat: Story = {
  args: { span: llmChatSpan },
};

/**
 * An LLM span with a provider icon, tool (function) definitions in a Tools
 * tab, and a tool-call output message.
 */
export const LLMWithToolDefinitions: Story = {
  args: { span: llmToolDefinitionsSpan },
};

/**
 * An agent step: input messages spanning system / user / assistant / tool
 * roles and an output message containing tool calls.
 */
export const LLMWithToolCalls: Story = {
  args: { span: llmToolCallsSpan },
};

/**
 * An LLM call traced with a prompt template and template variables instead
 * of chat messages.
 */
export const LLMPromptTemplate: Story = {
  args: { span: llmPromptTemplateSpan },
};

/**
 * Multi-modal input message contents: text alongside an image URL and a
 * redacted image.
 */
export const LLMMultiModal: Story = {
  args: { span: llmMultiModalSpan },
};

/**
 * A failed LLM call: danger status alert with the status message and no
 * output.
 */
export const LLMError: Story = {
  args: { span: llmErrorSpan },
};

/**
 * A retriever with retrieved documents, retrieval metrics, and LLM document
 * evaluations (annotations).
 */
export const Retriever: Story = {
  args: { span: retrieverSpan },
};

/**
 * A reranker (Cohere) with a query, input documents, and reranked output
 * documents.
 */
export const Reranker: Story = {
  args: { span: rerankerSpan },
};

/**
 * An embedding span showing the embedded text and model name.
 */
export const Embedding: Story = {
  args: { span: embeddingSpan },
};

/**
 * An embedding span with no embeddings attribute — falls back to the generic
 * input / output view.
 */
export const EmbeddingWithoutEmbeddings: Story = {
  args: { span: embeddingWithoutEmbeddingsSpan },
};

/**
 * A tool invocation (LangGraph agent) with a tool description card and a
 * metadata card.
 */
export const Tool: Story = {
  args: { span: toolSpan },
};

/**
 * A Bash tool invocation from a Claude Code trace with text input and
 * output.
 */
export const ToolBash: Story = {
  args: { span: toolBashSpan },
};

/**
 * The generic (chain) view with plain-text input and output.
 */
export const ChainTextIO: Story = {
  args: { span: chainTextIOSpan },
};

/**
 * The generic (chain) view with JSON input and output.
 */
export const ChainJsonIO: Story = {
  args: { span: chainJsonIOSpan },
};

/**
 * A span with no input or output — falls back to showing all attributes.
 */
export const WithoutIO: Story = {
  args: { span: spanWithoutIOSpan },
};

/**
 * A span whose attributes payload is not valid JSON — renders the
 * un-parsable attributes warning.
 */
export const UnparsableAttributes: Story = {
  args: { span: unparsableAttributesSpan },
};
