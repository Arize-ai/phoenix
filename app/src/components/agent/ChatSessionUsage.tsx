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
`;

type ChatSessionUsage = {
  sessionId: string;
};

type CachePromptDetails = {
  "cache read": number;
  "cache write"?: number;
};

type CacheUsageDisplay = {
  summaryText: string | null;
  promptDetails: CachePromptDetails | undefined;
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

export function getCacheUsageDisplay({
  promptDetails,
}: {
  promptDetails: AgentSessionUsage["tokenCount"]["promptDetails"];
}): CacheUsageDisplay {
  if (!promptDetails) {
    return {
      summaryText: null,
      promptDetails: undefined,
    };
  }
  const cacheRead = promptDetails?.cacheRead ?? 0;
  const cacheWrite = promptDetails?.cacheWrite ?? 0;
  if (cacheRead <= 0 && cacheWrite <= 0) {
    return {
      summaryText: null,
      promptDetails: undefined,
    };
  }
  const visiblePromptDetails: CachePromptDetails = {
    "cache read": cacheRead,
  };
  const summaryParts = [`cache read ${cacheRead.toLocaleString()}`];

  // OpenAI does not report cache writes, so we omit this metric from the UI when it's zero.
  if (cacheWrite > 0) {
    visiblePromptDetails["cache write"] = cacheWrite;
    summaryParts.push(`cache write ${cacheWrite.toLocaleString()}`);
  }

  return {
    summaryText: `latest ${summaryParts.join(" / ")}`,
    promptDetails: visiblePromptDetails,
  };
}

export const ChatSessionUsage = ({ sessionId }: ChatSessionUsage) => {
  const usage = useAgentContext((state) => {
    const session = state.sessionMap[sessionId];
    if (!session) return null;
    return getLatestAssistantMessageUsage(session.messages) ?? session.usage;
  });
  if (!usage) return null;
  const { summaryText, promptDetails } = getCacheUsageDisplay({
    promptDetails: usage.tokenCount.promptDetails,
  });
  return (
    <div css={chatSessionUsageCSS}>
      {summaryText ? (
        <Text size="XS" color="text-300" fontFamily="mono">
          {summaryText}
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
