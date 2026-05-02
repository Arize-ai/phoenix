import type { InitialFiles } from "just-bash";

import { createManifestFile } from "@phoenix/agent/tools/bash/context/filesystem/manifest";
import {
  PHOENIX_META_ROOT,
  PHOENIX_ROOT,
} from "@phoenix/agent/tools/bash/context/filesystem/pathConstants";
import type {
  AdapterResult,
  AdapterMetadata,
  AgentContextRefreshReason,
  AgentPageContext,
} from "@phoenix/agent/tools/bash/context/pageContextTypes";

import { buildGraphqlContextFiles } from "./fileBuilders/buildGraphqlContextFiles";

const PAGE_CONTEXT_MANIFEST_FRAGMENT =
  "Page context includes the current pathname, route hierarchy, route params, and search params.";

function createJsonFile(payload: unknown) {
  return JSON.stringify(payload, null, 2);
}

function createMetadata({
  pageContext,
  refreshReason,
  files,
}: {
  pageContext: AgentPageContext;
  refreshReason: AgentContextRefreshReason;
  files: string[];
}): AdapterMetadata {
  return {
    generatedAt: new Date().toISOString(),
    refreshReason,
    pathname: pageContext.pathname,
    search: pageContext.search,
    params: pageContext.params,
    files: [...files].sort(),
  };
}

async function buildPageContextFiles(
  pageContext: AgentPageContext
): Promise<InitialFiles> {
  return {
    [`${PHOENIX_ROOT}/page-context.json`]: createJsonFile(pageContext),
    ...(await buildGraphqlContextFiles(pageContext)),
  };
}

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
  const fileContents = await buildPageContextFiles(pageContext);
  const metadata = createMetadata({
    pageContext,
    refreshReason,
    files: [
      ...Object.keys(fileContents),
      `${PHOENIX_ROOT}/MANIFEST.md`,
      `${PHOENIX_META_ROOT}/context.json`,
    ],
  });

  return {
    files: {
      ...fileContents,
      [`${PHOENIX_META_ROOT}/context.json`]: createJsonFile(metadata),
      [`${PHOENIX_ROOT}/MANIFEST.md`]: createManifestFile({
        metadata,
        manifestFragment: PAGE_CONTEXT_MANIFEST_FRAGMENT,
      }),
    },
    metadata,
    manifestFragment: PAGE_CONTEXT_MANIFEST_FRAGMENT,
  };
}
