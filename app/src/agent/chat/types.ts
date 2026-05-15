import type { UIMessage } from "ai";

import type { AgentChatDataParts } from "@phoenix/agent/chat/advertisedTools";
import type { components } from "@phoenix/api/__generated__/v1";

/**
 * AI SDK `UIMessage` parameterized with the backend's assistant-message
 * metadata shape, sourced from the generated OpenAPI types.
 */
export type AgentUIMessage = UIMessage<
  components["schemas"]["AssistantMessageMetadata"],
  AgentChatDataParts
>;
