import type { UIMessage } from "ai";

import type { components } from "@phoenix/api/__generated__/v1";

export type AssistantMessageMetadata =
  components["schemas"]["AssistantMessageMetadata"];

export type UserMessageMetadata = components["schemas"]["UserMessageMetadata"];

type AgentMessageMetadata = NonNullable<
  components["schemas"]["PhoenixUIMessage"]["metadata"]
>;

/** Wire schema of the transient `data-session-summary` stream chunk. */
type SessionSummaryChunk = components["schemas"]["SessionSummaryChunk"];

/** Canonical session metadata emitted after first-message persistence. */
type SessionCreatedChunk = components["schemas"]["SessionCreatedChunk"];
export type AgentSessionCreatedData = SessionCreatedChunk["data"];

/** Canonical persistence acknowledgement for the completed transcript. */
type SessionCommittedChunk = components["schemas"]["SessionCommittedChunk"];
export type AgentSessionCommittedData = SessionCommittedChunk["data"];

/**
 * Payloads of the custom `data-*` chunks the backend chat route streams
 * alongside the message. Keys are the chunk type without the `data-` prefix.
 */
type AgentUIDataTypes = {
  "session-created": AgentSessionCreatedData;
  "session-committed": AgentSessionCommittedData;
  "session-summary": SessionSummaryChunk["data"];
};

/**
 * AI SDK `UIMessage` parameterized with the backend's wire schemas, sourced
 * from the generated OpenAPI types.
 */
export type AgentUIMessage = UIMessage<AgentMessageMetadata, AgentUIDataTypes>;

/** Narrow a message's metadata to the assistant shape. */
export function getAssistantMessageMetadata(
  message: AgentUIMessage
): AssistantMessageMetadata | undefined {
  const metadata = message.metadata;
  return metadata?.type === "assistant" ? metadata : undefined;
}
