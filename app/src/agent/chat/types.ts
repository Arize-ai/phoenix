import type { UIMessage } from "ai";

import type { components } from "@phoenix/api/__generated__/v1";

export type PxiTurnCompleteData = {
  sessionId: string;
  trace: components["schemas"]["AssistantMessageMetadataTraceIds"] | null;
  backendTraceFlushed: boolean;
};

export type AgentDataParts = {
  "pxi-turn-complete": PxiTurnCompleteData;
};

/**
 * AI SDK `UIMessage` parameterized with the backend's assistant-message
 * metadata shape, sourced from the generated OpenAPI types.
 */
export type AgentUIMessage = UIMessage<
  components["schemas"]["AssistantMessageMetadata"],
  AgentDataParts
>;
