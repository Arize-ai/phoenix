import { css } from "@emotion/react";
import { useCallback } from "react";

import { TokenCount } from "@phoenix/components/trace";
import { useAgentContext } from "@phoenix/contexts/AgentContext";
import type { AgentState } from "@phoenix/store";

const chatSessionUsageCSS = css`
  display: flex;
  flex-direction: row-reverse;
  width: 100%;
  justify-content: space-between;
  padding: 0 var(--global-dimension-static-size-200);
`;

type ChatSessionUsage = {
  sessionId: string;
};

export const ChatSessionUsage = ({ sessionId }: ChatSessionUsage) => {
  const usageSelector = useCallback(
    (state: AgentState) => {
      const session = state.sessionMap[sessionId];
      if (!session) return null;
      return session.usage;
    },
    [sessionId]
  );
  const usage = useAgentContext(usageSelector);
  if (!usage) return null;
  return (
    <div css={chatSessionUsageCSS}>
      <TokenCount size="S" color="text-300">
        {usage.tokenCount.total}
      </TokenCount>
    </div>
  );
};
