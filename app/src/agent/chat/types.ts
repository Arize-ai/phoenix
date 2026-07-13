import type { UIMessage } from "ai";

import type { components } from "@phoenix/api/__generated__/v1";

export type AssistantMessageMetadata =
  components["schemas"]["AssistantMessageMetadata"];

export type UserMessageMetadata = components["schemas"]["UserMessageMetadata"];

/**
 * AI SDK `UIMessage` parameterized with the backend's message metadata
 * shapes, sourced from the generated OpenAPI types. Assistant messages carry
 * `AssistantMessageMetadata` (streamed back via `message_metadata`); user
 * messages carry `UserMessageMetadata` (stamped at send time).
 */
export type AgentUIMessage = UIMessage<
  AssistantMessageMetadata | UserMessageMetadata
>;

/**
 * Narrow a message's metadata to the assistant shape. The assistant shape is
 * the only one with a required `sessionId`, so its presence discriminates the
 * union.
 */
export function getAssistantMessageMetadata(
  message: AgentUIMessage
): AssistantMessageMetadata | undefined {
  const metadata = message.metadata;
  return metadata != null && "sessionId" in metadata ? metadata : undefined;
}
