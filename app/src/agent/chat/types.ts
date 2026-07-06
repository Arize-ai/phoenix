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
 * Wire type of the backend's terminal turn data part. Must match the
 * `DataChunk` type emitted by `_build_turn_complete_chunk` in
 * `src/phoenix/server/api/routers/agents.py` (the AI SDK prefixes data-part
 * keys with `data-`).
 */
export const PXI_TURN_COMPLETE_DATA_TYPE =
  "data-pxi-turn-complete" satisfies `data-${keyof AgentDataParts}`;

/**
 * AI SDK `UIMessage` parameterized with the backend's assistant-message
 * metadata shape, sourced from the generated OpenAPI types.
 */
export type AgentUIMessage = UIMessage<
  components["schemas"]["AssistantMessageMetadata"],
  AgentDataParts
>;
