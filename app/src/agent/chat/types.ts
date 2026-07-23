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
type TranscriptPersistedChunk =
  components["schemas"]["TranscriptPersistedChunk"];

/**
 * Payloads of the custom `data-*` chunks the backend chat route streams
 * alongside the message. Keys are the chunk type without the `data-` prefix.
 */
type AgentUIDataTypes = {
  "session-summary": SessionSummaryChunk["data"];
  "transcript-persisted": TranscriptPersistedChunk["data"];
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

/** Whether a user-role transcript message is a durable compaction point. */
export function isCompactionMessage(message: AgentUIMessage): boolean {
  return (
    message.role === "user" &&
    message.metadata?.type === "user" &&
    message.metadata.isCompactionMessage === true
  );
}

/** Return the text content stored in a durable compaction message. */
export function getCompactionSummary(message: AgentUIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}
