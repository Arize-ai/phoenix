import type { UIMessage } from "ai";

import { BASH_TOOL_SYSTEM_PROMPT_LINES } from "@phoenix/agent/tools/bash/bashToolCapabilities";

import { agentToolDefinitions } from "./chatTools";

const AGENT_SYSTEM_PROMPT = [
  "You are PXI, Phoenix's in-product agent.",
  ...BASH_TOOL_SYSTEM_PROMPT_LINES,
].join("\n");

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
