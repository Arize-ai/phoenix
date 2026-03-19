import type { InitialFiles } from "just-bash";

import {
  createContextMetadataFile,
  createIndexFile,
  createManifestFile,
  getPhoenixTopLevelIndexPaths,
  PHOENIX_META_ROOT,
  PHOENIX_ROOT,
} from "@phoenix/agent/context/filesystem";
import type {
  AdapterResult,
  AdapterMetadata,
  AgentContextRefreshReason,
  AgentPageContext,
} from "@phoenix/agent/context/pageContextTypes";

export type ContextFileMap = InitialFiles;

export function serializeJsonLines(rows: unknown[]) {
  if (rows.length === 0) {
    return "";
  }

  return `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`;
}

function createTopLevelSkeletonFiles() {
  const topLevelIndexPaths = getPhoenixTopLevelIndexPaths();

  return Object.fromEntries(
    topLevelIndexPaths.map((filePath) => [
      filePath,
      createIndexFile({
        path: filePath.replace(/\/INDEX\.json$/, ""),
        entries: [],
      }),
    ])
  );
}

function createMetadata({
  pageContext,
  refreshReason,
  adapterId,
  adapterName,
  files,
}: {
  pageContext: AgentPageContext;
  refreshReason: AgentContextRefreshReason;
  adapterId: string;
  adapterName: string;
  files: string[];
}): AdapterMetadata {
  return {
    adapterId,
    adapterName,
    generatedAt: new Date().toISOString(),
    refreshReason,
    pathname: pageContext.pathname,
    search: pageContext.search,
    params: pageContext.params,
    timeRange: pageContext.timeRange,
    files: [...files].sort(),
  };
}

function getMetadataFilePaths(filePaths: string[]) {
  return [
    ...filePaths,
    `${PHOENIX_ROOT}/MANIFEST.md`,
    `${PHOENIX_META_ROOT}/context.json`,
  ];
}

export function withManifestAndMetadata({
  files,
  pageContext,
  refreshReason,
  adapterId,
  adapterName,
  manifestFragment,
}: {
  files: ContextFileMap;
  pageContext: AgentPageContext;
  refreshReason: AgentContextRefreshReason;
  adapterId: string;
  adapterName: string;
  manifestFragment?: string;
}): AdapterResult {
  const filePaths = Object.keys(files);
  const metadata = createMetadata({
    pageContext,
    refreshReason,
    adapterId,
    adapterName,
    files: getMetadataFilePaths(filePaths),
  });

  return {
    files: {
      ...createTopLevelSkeletonFiles(),
      ...files,
      [`${PHOENIX_META_ROOT}/context.json`]:
        createContextMetadataFile(metadata),
      [`${PHOENIX_ROOT}/MANIFEST.md`]: createManifestFile({
        metadata,
        manifestFragment,
      }),
    },
    metadata,
    manifestFragment,
  };
}
