import {
  createIndexFile,
  createTableSchemaFile,
  getPhoenixProjectRoot,
  getPhoenixTablesRoot,
  getPhoenixTraceRoot,
} from "@phoenix/agent/context/filesystem";
import type {
  AgentContextRefreshReason,
  AgentPageContext,
} from "@phoenix/agent/context/pageContextTypes";
import type { PageContextData } from "@phoenix/agent/context/sources/types";

import { serializeJsonLines, withManifestAndMetadata } from "./shared";

type TracePageContextData = Extract<PageContextData, { pageKind: "trace" }>;

export function materializeTracePageContext({
  pageContext,
  refreshReason,
  data,
}: {
  pageContext: AgentPageContext;
  refreshReason: AgentContextRefreshReason;
  data: TracePageContextData;
}) {
  const traceRoot = getPhoenixTraceRoot(data.trace.id);
  const tablesRoot = getPhoenixTablesRoot(traceRoot);
  const projectRoot = getPhoenixProjectRoot(data.project.id);

  return withManifestAndMetadata({
    files: {
      [`${projectRoot}/project.json`]: JSON.stringify(
        {
          id: data.project.id,
          name: data.project.name,
          timeRange: pageContext.timeRange,
        },
        null,
        2
      ),
      [`${projectRoot}/INDEX.json`]: createIndexFile({
        entityType: "project",
        id: data.project.id,
        tracePath: traceRoot,
      }),
      [`${traceRoot}/trace.json`]: JSON.stringify(data.trace, null, 2),
      [`${traceRoot}/INDEX.json`]: createIndexFile({
        entityType: "trace",
        id: data.trace.id,
        projectId: data.project.id,
        tables: tablesRoot,
      }),
      [`${traceRoot}/tree.json`]: JSON.stringify(
        {
          rootSpans: data.trace.rootSpans,
        },
        null,
        2
      ),
      [`${tablesRoot}/_schema.json`]: createTableSchemaFile({
        spans: {
          format: "jsonl",
          columns: [
            "id",
            "spanId",
            "name",
            "spanKind",
            "statusCode",
            "startTime",
            "endTime",
            "parentId",
          ],
        },
      }),
      [`${tablesRoot}/spans.jsonl`]: serializeJsonLines(data.spans),
    },
    pageContext,
    refreshReason,
    adapterId: "page-context-trace",
    adapterName: "Trace Page Context Adapter",
    manifestFragment: `Trace context is available under ${traceRoot}.`,
  });
}
