import type { UIMessage } from "ai";

import { agentToolDefinitions } from "./chatTools";

type BuildAgentChatRequestBodyOptions = {
  body: Record<string, unknown> | undefined;
  id: string;
  messages: UIMessage[];
  trigger: "submit-message" | "regenerate-message";
  messageId: string | undefined;
};

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
    tools: agentToolDefinitions,
  };
}
