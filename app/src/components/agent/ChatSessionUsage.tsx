import { useMemo } from "react";

import {
  getAssistantMessageMetadata,
  type AgentUIMessage,
} from "@phoenix/agent/chat/types";

import { ChatTokenUsage } from "./ChatTokenUsage";

type ChatSessionUsageProps = {
  /** The session's current transcript; token usage is accumulated across assistant turns. */
  messages: AgentUIMessage[];
  /** The compaction boundary, before which usage is no longer part of the active context. */
  compactionMessageId?: string;
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
 * Accumulate token usage after an optional message boundary while retaining
 * cache details from only the latest assistant turn that reported usage.
 */
export function getConversationUsage({
  messages,
  afterMessageId,
}: {
  messages: AgentUIMessage[];
  afterMessageId?: string;
}): AgentSessionUsage | null {
  let prompt = 0;
  let completion = 0;
  let total = 0;
  let promptDetails: AgentSessionUsage["tokenCount"]["promptDetails"];
  let hasUsage = false;

  const boundaryIndex = afterMessageId
    ? messages.findIndex((message) => message.id === afterMessageId)
    : -1;
  const activeMessages = messages.slice(boundaryIndex + 1);

  for (const message of activeMessages) {
    if (message?.role !== "assistant") {
      continue;
    }
    const usage = getAssistantMessageMetadata(message)?.usage;
    if (usage == null) {
      continue;
    }
    hasUsage = true;
    prompt += usage.tokens.prompt;
    completion += usage.tokens.completion;
    total += usage.tokens.total;
    promptDetails = usage.promptDetails ?? undefined;
  }

  if (!hasUsage) {
    return null;
  }

  return {
    tokenCount: {
      prompt,
      completion,
      total,
      ...(promptDetails ? { promptDetails } : {}),
    },
  } satisfies AgentSessionUsage;
}

export const ChatSessionUsage = ({
  messages,
  compactionMessageId,
}: ChatSessionUsageProps) => {
  const usage = useMemo(
    () =>
      getConversationUsage({
        messages,
        afterMessageId: compactionMessageId,
      }),
    [compactionMessageId, messages]
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
