import { materializePageContext } from "@phoenix/agent/context/materializers/materializePageContext";
import type {
  AdapterResult,
  AgentContextRefreshReason,
  AgentPageContext,
} from "@phoenix/agent/context/pageContextTypes";
import { graphqlPageContextSource } from "@phoenix/agent/context/sources/__experimental__/graphql/graphqlPageContextSource";

export async function generatePageContextFiles({
  pageContext,
  refreshReason,
}: {
  pageContext: AgentPageContext;
  refreshReason: AgentContextRefreshReason;
}): Promise<AdapterResult> {
  const data = await graphqlPageContextSource.load(pageContext);

  return materializePageContext({
    pageContext,
    refreshReason,
    data,
  });
}
