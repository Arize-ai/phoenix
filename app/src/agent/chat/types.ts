import type { UIMessage } from "ai";

import type { components } from "@phoenix/api/__generated__/v1";

export type AssistantMessageMetadata =
  components["schemas"]["AssistantMessageMetadata"];

export type UserMessageMetadata = components["schemas"]["UserMessageMetadata"];

type AgentMessageMetadata = NonNullable<
  components["schemas"]["PhoenixUIMessage"]["metadata"]
>;

export type AgentUIMessage = UIMessage<AgentMessageMetadata>;

/** Narrow a message's metadata to the assistant shape. */
export function getAssistantMessageMetadata(
  message: AgentUIMessage
): AssistantMessageMetadata | undefined {
  const metadata = message.metadata;
  return metadata?.type === "assistant" ? metadata : undefined;
}
