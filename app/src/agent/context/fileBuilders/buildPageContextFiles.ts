import { PHOENIX_ROOT } from "@phoenix/agent/context/filesystem";
import type { AgentPageContext } from "@phoenix/agent/context/pageContextTypes";

import { buildGraphqlContextFiles } from "./buildGraphqlContextFiles";

export function buildPageContextFiles(pageContext: AgentPageContext) {
  return {
    [`${PHOENIX_ROOT}/page-context.json`]: JSON.stringify(pageContext, null, 2),
    ...buildGraphqlContextFiles(pageContext),
  };
}
