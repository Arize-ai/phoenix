import {
  getAssistantMessageMetadata,
  type AgentUIMessage,
} from "@phoenix/agent/chat/types";

import { ChatTokenUsage } from "./ChatTokenUsage";

type ChatSessionUsageProps = {
  /** The session's current transcript; usage is read from the latest assistant message. */
  messages: AgentUIMessage[];
};

/**
 * Usage metrics like token usage.
 *
 * May be extended to costs, tool call count, etc
 */
export type AgentSessionUsage = {
  tokenCount: {
    prompt: number;
    completion: number;
    total: number;
    promptDetails?: {
      cacheRead: number;
      cacheWrite: number;
    };
  };
  // this can be extended with cost in the future
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

export const ChatSessionUsage = ({ messages }: ChatSessionUsageProps) => {
  const usage = getLatestAssistantMessageUsage(messages);
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
