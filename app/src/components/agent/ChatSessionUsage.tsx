import {
  getAssistantMessageMetadata,
  type AgentUIMessage,
} from "@phoenix/agent/chat/types";
import { useAgentContext } from "@phoenix/contexts/AgentContext";
import type { AgentSessionUsage } from "@phoenix/store";

import { ChatTokenUsage } from "./ChatTokenUsage";

type ChatSessionUsage = {
  sessionId: string;
};

function getLatestAssistantMessageUsage(
  messages: AgentUIMessage[]
): AgentSessionUsage | null {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (message?.role !== "assistant") {
      continue;
    }
    const usage = getAssistantMessageMetadata(message)?.usage;
    if (usage == null) {
      continue;
    }
    return {
      tokenCount: {
        ...usage.tokens,
        ...(usage.promptDetails ? { promptDetails: usage.promptDetails } : {}),
      },
    } satisfies AgentSessionUsage;
  }
  return null;
}

export const ChatSessionUsage = ({ sessionId }: ChatSessionUsage) => {
  const usage = useAgentContext((state) => {
    const session = state.sessionMap[sessionId];
    if (!session) return null;
    return getLatestAssistantMessageUsage(session.messages) ?? session.usage;
  });
  if (!usage) return null;
  return (
    <ChatTokenUsage
      total={usage.tokenCount.total}
      prompt={usage.tokenCount.prompt}
      completion={usage.tokenCount.completion}
      promptDetails={usage.tokenCount.promptDetails}
    />
  );
};
