import { generatePageContextFiles } from "@phoenix/agent/context/filesystem/generatePageContextFiles";
import type {
  AgentContextRefreshReason,
  AgentPageContext,
} from "@phoenix/agent/context/pageContextTypes";
import { replaceBashToolPhoenixContext } from "@phoenix/agent/tools/bash/bashToolSessionRegistry";

type RefreshAgentSessionContextOptions = {
  sessionId: string | null;
  pageContext: AgentPageContext;
  refreshReason: AgentContextRefreshReason;
  canReplacePhoenixContext?: () => boolean;
};

export async function refreshAgentSessionContext({
  sessionId,
  pageContext,
  refreshReason,
  canReplacePhoenixContext,
}: RefreshAgentSessionContextOptions) {
  const result = await generatePageContextFiles({
    pageContext,
    refreshReason,
  });

  if (canReplacePhoenixContext && !canReplacePhoenixContext()) {
    return result;
  }

  await replaceBashToolPhoenixContext(sessionId, result.files);

  return result;
}
