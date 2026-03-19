import type { UIMessage } from "ai";

import { agentToolDefinitions } from "./chatTools";
import { AGENT_SYSTEM_PROMPT } from "./systemPrompt";

type BuildAgentChatRequestBodyOptions = {
  body: Record<string, unknown> | undefined;
  id: string;
  messages: UIMessage[];
  trigger: "submit-message" | "regenerate-message";
  messageId: string | undefined;
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
}: BuildAgentChatRequestBodyOptions) {
  return {
    ...body,
    id,
    messages,
    trigger,
    messageId,
    system: AGENT_SYSTEM_PROMPT,
    tools: agentToolDefinitions,
  };
}
