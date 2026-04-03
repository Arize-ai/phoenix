import type { UIMessage } from "ai";

import { agentToolDefinitions } from "./chatTools";
import { AGENT_SYSTEM_PROMPT } from "./systemPrompt";

type BuildAgentChatRequestBodyOptions = {
  /** Existing request body from the AI SDK transport, if any. */
  body: Record<string, unknown> | undefined;
  /** Chat identifier used by the transport for this conversation. */
  id: string;
  /** Full UI message history sent with the request. */
  messages: UIMessage[];
  /** Reason the transport is sending this request. */
  trigger: "submit-message" | "regenerate-message";
  /** Optional message identifier for regenerate flows. */
  messageId: string | undefined;
  /** Optional PXI session id used to associate traces across turns. */
  sessionId?: string | null;
};

/** Request payload sent to the PXI agent chat endpoint. */
type BuildAgentChatRequestBodyResult = Record<string, unknown> & {
  /** Chat identifier used by the transport for this conversation. */
  id: string;
  /** Full UI message history sent with the request. */
  messages: UIMessage[];
  /** Reason the transport is sending this request. */
  trigger: "submit-message" | "regenerate-message";
  /** Optional message identifier for regenerate flows. */
  messageId: string | undefined;
  /** System prompt applied to PXI agent chat requests. */
  system: string;
  /** Frontend tool definitions exposed for client-side execution. */
  tools: typeof agentToolDefinitions;
  /** Distinguishes normal chat turns from other PXI chat request types. */
  traceNameSuffix: "Turn";
  /** Optional PXI session id used to associate traces across turns. */
  sessionId?: string;
};

/**
 * Merges the AI SDK transport payload with the frontend tool definitions that
 * the agent chat API expects for client-side tool execution.
 */
export function buildAgentChatRequestBody({
  body,
  id,
  messages,
  trigger,
  messageId,
  sessionId,
}: BuildAgentChatRequestBodyOptions): BuildAgentChatRequestBodyResult {
  return {
    ...body,
    id,
    messages,
    trigger,
    messageId,
    system: AGENT_SYSTEM_PROMPT,
    tools: agentToolDefinitions,
    traceNameSuffix: "Turn",
    ...(sessionId ? { sessionId } : {}),
  };
}
