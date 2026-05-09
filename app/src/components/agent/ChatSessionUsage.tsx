import { css } from "@emotion/react";
import { Pressable } from "react-aria";

import type { AgentUIMessage } from "@phoenix/agent/chat/types";
import {
  RichTooltip,
  Text,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components";
import { TokenCount, TokenCountDetails } from "@phoenix/components/trace";
import { useAgentContext } from "@phoenix/contexts/AgentContext";
import type { AgentSessionUsage } from "@phoenix/store";

const chatSessionUsageCSS = css`
  display: flex;
  flex-direction: row;
  width: 100%;
  justify-content: flex-end;
  align-items: center;
  gap: var(--global-dimension-static-size-100);
  padding: 0 var(--global-dimension-static-size-200);
`;

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
    const usage = message.metadata?.usage;
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
  const promptDetails = usage.tokenCount.promptDetails
    ? {
        "cache read": usage.tokenCount.promptDetails.cacheRead,
        "cache write": usage.tokenCount.promptDetails.cacheWrite,
      }
    : undefined;
  const cacheRead = usage.tokenCount.promptDetails?.cacheRead ?? 0;
  const cacheWrite = usage.tokenCount.promptDetails?.cacheWrite ?? 0;
  const hasCacheUsage = cacheRead > 0 || cacheWrite > 0;
  return (
    <div css={chatSessionUsageCSS}>
      {hasCacheUsage ? (
        <Text size="XS" color="text-300" fontFamily="mono">
          latest cache read {cacheRead.toLocaleString()} / write{" "}
          {cacheWrite.toLocaleString()}
        </Text>
      ) : null}
      <TooltipTrigger>
        <Pressable>
          <TokenCount size="S" color="text-300" role="button" tabIndex={0}>
            {usage.tokenCount.total}
          </TokenCount>
        </Pressable>
        <RichTooltip>
          <TooltipArrow />
          <TokenCountDetails
            total={usage.tokenCount.total}
            prompt={usage.tokenCount.prompt}
            completion={usage.tokenCount.completion}
            promptDetails={promptDetails}
          />
        </RichTooltip>
      </TooltipTrigger>
    </div>
  );
};
