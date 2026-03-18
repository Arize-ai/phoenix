import {
  createIndexFile,
  createTableSchemaFile,
  getPhoenixProjectRoot,
  getPhoenixTablesRoot,
} from "@phoenix/agent/context/filesystem";
import type {
  AgentContextRefreshReason,
  AgentPageContext,
} from "@phoenix/agent/context/pageContextTypes";
import type { PageContextData } from "@phoenix/agent/context/sources/types";

import { serializeJsonLines, withManifestAndMetadata } from "./shared";

type ProjectPageContextData = Extract<PageContextData, { pageKind: "project" }>;

export function materializeProjectPageContext({
  pageContext,
  refreshReason,
  data,
}: {
  pageContext: AgentPageContext;
  refreshReason: AgentContextRefreshReason;
  data: ProjectPageContextData;
}) {
  const projectRoot = getPhoenixProjectRoot(data.project.id);
  const tablesRoot = getPhoenixTablesRoot(projectRoot);

  return withManifestAndMetadata({
    files: {
      [`${projectRoot}/project.json`]: JSON.stringify(
        {
          ...data.project,
          timeRange: pageContext.timeRange,
          projectTab: pageContext.projectTab,
        },
        null,
        2
      ),
      [`${projectRoot}/INDEX.json`]: createIndexFile({
        entityType: "project",
        id: data.project.id,
        name: data.project.name,
        paths: {
          summary: `${projectRoot}/project.json`,
          tables: tablesRoot,
        },
      }),
      [`${tablesRoot}/_schema.json`]: createTableSchemaFile({
        traces: {
          format: "jsonl",
          columns: [
            "id",
            "trace.traceId",
            "name",
            "statusCode",
            "startTime",
            "endTime",
            "latencyMs",
          ],
        },
        spans: {
          format: "jsonl",
          columns: [
            "id",
            "trace.traceId",
            "spanId",
            "name",
            "statusCode",
            "startTime",
            "latencyMs",
          ],
        },
        sessions: {
          format: "jsonl",
          columns: ["id", "sessionId", "numTraces", "startTime", "endTime"],
        },
      }),
      [`${tablesRoot}/traces.jsonl`]: serializeJsonLines(data.traces),
      [`${tablesRoot}/spans.jsonl`]: serializeJsonLines(data.spans),
      [`${tablesRoot}/sessions.jsonl`]: serializeJsonLines(data.sessions),
    },
    pageContext,
    refreshReason,
    adapterId: "page-context-project",
    adapterName: "Project Page Context Adapter",
    manifestFragment: `Project context is available under ${projectRoot}. Project tables are available under ${tablesRoot}.`,
  });
}
