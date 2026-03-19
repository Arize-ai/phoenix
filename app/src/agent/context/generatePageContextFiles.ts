import { withManifestAndMetadata } from "@phoenix/agent/context/materializers/shared";
import type {
  AdapterResult,
  AgentContextRefreshReason,
  AgentPageContext,
} from "@phoenix/agent/context/pageContextTypes";

import { buildPageContextFiles } from "./fileBuilders/buildPageContextFiles";

const PAGE_CONTEXT_MANIFEST_FRAGMENT =
  "Page context includes the current pathname, route hierarchy, route params, search params, and time range only.";

/**
 * Materializes the lightweight `/phoenix` page context files for the current route.
 */
export async function generatePageContextFiles({
  pageContext,
  refreshReason,
}: {
  pageContext: AgentPageContext;
  refreshReason: AgentContextRefreshReason;
}): Promise<AdapterResult> {
  const files = buildPageContextFiles(pageContext);

  return withManifestAndMetadata({
    files,
    pageContext,
    refreshReason,
    adapterId: "page-context-metadata-only",
    adapterName: "Page Context Metadata Adapter",
    manifestFragment: PAGE_CONTEXT_MANIFEST_FRAGMENT,
  });
}
