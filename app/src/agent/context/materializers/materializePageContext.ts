import type {
  AdapterResult,
  AgentContextRefreshReason,
  AgentPageContext,
} from "@phoenix/agent/context/pageContextTypes";
import type { PageContextData } from "@phoenix/agent/context/sources/types";

import { materializeGenericPageContext } from "./genericPageMaterializer";
import { materializeProjectPageContext } from "./projectPageMaterializer";
import { materializeTracePageContext } from "./tracePageMaterializer";

export function materializePageContext({
  pageContext,
  refreshReason,
  data,
}: {
  pageContext: AgentPageContext;
  refreshReason: AgentContextRefreshReason;
  data: PageContextData;
}): AdapterResult {
  if (data.pageKind === "project") {
    return materializeProjectPageContext({
      pageContext,
      refreshReason,
      data,
    });
  }

  if (data.pageKind === "trace") {
    return materializeTracePageContext({
      pageContext,
      refreshReason,
      data,
    });
  }

  return materializeGenericPageContext({
    pageContext,
    refreshReason,
  });
}
