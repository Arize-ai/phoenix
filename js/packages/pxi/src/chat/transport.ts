import { DefaultChatTransport } from "ai";

import { buildRequestBody } from "./buildRequestBody";
import type { AgentUIMessage, ModelSelection } from "./types";

export type CreateTransportOptions = {
  /** Fully-resolved server-agent chat URL. */
  chatUrl: string;
  /** Headers applied to every request (auth + custom client headers). */
  headers: Record<string, string>;
  /** Provider + model selection for every turn in this session. */
  model: ModelSelection;
};

/**
 * Create the AI SDK transport that talks to the Phoenix server-agent chat
 * endpoint. This mirrors how the Phoenix web app wires `DefaultChatTransport`
 * (see `useAgentChat.ts`): the transport handles SSE framing while
 * `prepareSendMessagesRequest` injects the typed PXI request body.
 */
export function createServerAgentTransport({
  chatUrl,
  headers,
  model,
}: CreateTransportOptions): DefaultChatTransport<AgentUIMessage> {
  return new DefaultChatTransport<AgentUIMessage>({
    api: chatUrl,
    headers,
    prepareSendMessagesRequest: ({ id, messages, trigger, messageId }) => ({
      body: buildRequestBody({ id, messages, trigger, messageId, model }),
    }),
  });
}
