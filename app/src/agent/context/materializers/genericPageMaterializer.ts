import type {
  AgentContextRefreshReason,
  AgentPageContext,
} from "@phoenix/agent/context/pageContextTypes";

import { withManifestAndMetadata } from "./shared";

const GENERIC_PAGE_CONTEXT_MANIFEST_FRAGMENT =
  "No project- or trace-specific data was available for this page.";

export function materializeGenericPageContext({
  pageContext,
  refreshReason,
}: {
  pageContext: AgentPageContext;
  refreshReason: AgentContextRefreshReason;
}) {
  return withManifestAndMetadata({
    files: {},
    pageContext,
    refreshReason,
    adapterId: "page-context-generic",
    adapterName: "Generic Page Context Adapter",
    manifestFragment: GENERIC_PAGE_CONTEXT_MANIFEST_FRAGMENT,
  });
}
