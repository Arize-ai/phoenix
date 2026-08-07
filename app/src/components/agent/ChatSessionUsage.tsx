import { useMemo } from "react";

import {
  getAssistantMessageMetadata,
  type AgentUIMessage,
} from "@phoenix/agent/chat/types";
import { ChatTokenUsage } from "@phoenix/components/ai/token-usage";

type ChatSessionUsageProps = {
  /** The session's current transcript; usage comes from the latest assistant turn. */
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

/**
 * Return the usage from the most recent assistant turn that reported any.
 *
 * The server attaches the usage of the turn's final model request to each
 * assistant message, so the latest report reflects the tokens currently held
 * in context — i.e. what will be carried into the next turn.
 */
export function getConversationUsage({
  messages,
}: {
  messages: AgentUIMessage[];
}): AgentSessionUsage | null {
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
        prompt: usage.tokens.prompt,
        completion: usage.tokens.completion,
        total: usage.tokens.total,
        ...(usage.promptDetails ? { promptDetails: usage.promptDetails } : {}),
      },
    } satisfies AgentSessionUsage;
  }
  return null;
}

export const ChatSessionUsage = ({ messages }: ChatSessionUsageProps) => {
  const usage = useMemo(
    () =>
      getConversationUsage({
        messages,
      }),
    [messages]
  );
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
