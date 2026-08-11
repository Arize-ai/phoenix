import type { UIMessage } from "ai";

import type { components } from "@phoenix/api/__generated__/v1";

export type PhoenixAssistantMessageMetadata =
  components["schemas"]["PhoenixAssistantMessageMetadata"];

export type PhoenixUserMessageMetadata =
  components["schemas"]["PhoenixUserMessageMetadata"];

export type AgentMessageMetadata = NonNullable<
  components["schemas"]["PhoenixUIMessage"]["metadata"]
>;

/** Wire schema of the transient `data-session-summary` stream chunk. */
type SessionSummaryChunk = components["schemas"]["SessionSummaryChunk"];
type TranscriptPersistedChunk =
  components["schemas"]["TranscriptPersistedChunk"];
type AgentErrorChunk = components["schemas"]["AgentErrorChunk"];

/**
 * Payloads of the custom `data-*` chunks the backend chat route streams
 * alongside the message. Keys are the chunk type without the `data-` prefix.
 */
type AgentUIDataTypes = {
  error: AgentErrorChunk["data"];
  "session-summary": SessionSummaryChunk["data"];
  "transcript-persisted": TranscriptPersistedChunk["data"];
};

/**
 * AI SDK `UIMessage` parameterized with the backend's wire schemas, sourced
 * from the generated OpenAPI types.
 */
export type AgentUIMessage = UIMessage<AgentMessageMetadata, AgentUIDataTypes>;

/** A single part of an {@link AgentUIMessage}. */
export type AgentUIMessagePart = AgentUIMessage["parts"][number];

/** Narrow a message's metadata to the assistant shape. */
export function getAssistantMessageMetadata(
  message: AgentUIMessage
): PhoenixAssistantMessageMetadata | undefined {
  const phoenixMetadata = message.metadata?.phoenix;
  return phoenixMetadata?.type === "assistant" ? phoenixMetadata : undefined;
}

/** Whether a user-role transcript message is a durable compaction point. */
export function isCompactionMessage(message: AgentUIMessage): boolean {
  const phoenixMetadata = message.metadata?.phoenix;
  return (
    message.role === "user" &&
    phoenixMetadata?.type === "user" &&
    phoenixMetadata.isCompactionMessage === true
  );
}

/** Return the text content stored in a durable compaction message. */
export function getCompactionSummary(message: AgentUIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}
