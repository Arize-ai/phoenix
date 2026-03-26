import type { UIMessage } from "ai";

import { agentToolDefinitions } from "./chatTools";
import { AGENT_SYSTEM_PROMPT } from "./systemPrompt";

type BuildAgentChatRequestBodyOptions = {
  body: Record<string, unknown> | undefined;
  id: string;
  messages: UIMessage[];
  trigger: "submit-message" | "regenerate-message";
  messageId: string | undefined;
  sessionId?: string | null;
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
}: BuildAgentChatRequestBodyOptions) {
  return {
    ...body,
    id,
    messages,
    trigger,
    messageId,
    system: AGENT_SYSTEM_PROMPT,
    tools: agentToolDefinitions,
    traceNameSuffix: "Turn",
    // Sent as camelCase `sessionId` — the backend's CamelBaseModel
    // deserializes it to the `session_id` field on the request body,
    // which is then used to create/link a ProjectSession for the trace.
    ...(sessionId ? { sessionId } : {}),
  };
}
