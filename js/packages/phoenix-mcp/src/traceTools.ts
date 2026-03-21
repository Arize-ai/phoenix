import type { PhoenixClient } from "@arizeai/phoenix-client";
import { getTraces } from "@arizeai/phoenix-client/traces";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";

import { resolveProjectId } from "./client.js";
import {
  attachAnnotationsToSpans,
  fetchProjectSpans,
  fetchSpanAnnotations,
  resolveStartTime,
} from "./spanUtils.js";
import { jsonResponse } from "./toolResults.js";
import { buildTrace, groupSpansByTrace } from "./traceUtils.js";

const LIST_TRACES_DESCRIPTION = `List traces for a project.

This tool groups project spans into traces and returns the newest traces first.

Example usage:
  Show me the last 10 traces for project "default"
  Show me recent traces from the last 30 minutes for project "checkout"

Expected return:
  Array of trace objects with grouped spans and summary timing information.`;

const GET_TRACE_DESCRIPTION = `Get a single trace by trace ID or prefix within a project.

Example usage:
  Show me trace "abc123" from project "default"

Expected return:
  A trace object with all spans that belong to the matching trace.`;

async function fetchTraceSpans({
  client,
  projectId,
  traceId,
}: {
  client: PhoenixClient;
  projectId: string;
  traceId: string;
}) {
  const response = await fetchProjectSpans({
    client,
    projectIdentifier: projectId,
    filters: {
      traceIds: [traceId],
      limit: 1000,
    },
    totalLimit: undefined,
  });

  return response.spans;
}

export async function resolveTraceIdByPrefix({
  client,
  projectId,
  projectIdentifier,
  traceIdPrefix,
  pageLimit = 100,
}: {
  client: PhoenixClient;
  projectId: string;
  projectIdentifier: string;
  traceIdPrefix: string;
  pageLimit?: number;
}): Promise<string | null> {
  let cursor: string | null = null;
  const matchingTraceIds = new Set<string>();

  do {
    const tracePage = await getTraces({
      client,
      project: { projectId },
      cursor,
      limit: pageLimit,
      sort: "start_time",
      order: "desc",
    });

    for (const trace of tracePage.traces) {
      if (!trace.trace_id.startsWith(traceIdPrefix)) {
        continue;
      }

      matchingTraceIds.add(trace.trace_id);

      if (matchingTraceIds.size > 1) {
        throw new Error(
          `Trace ID prefix "${traceIdPrefix}" is ambiguous in project "${projectIdentifier}": ${Array.from(matchingTraceIds).join(", ")}`
        );
      }
    }

    cursor = tracePage.nextCursor;
  } while (cursor);

  return matchingTraceIds.values().next().value ?? null;
}

export const initializeTraceTools = ({
  client,
  server,
}: {
  client: PhoenixClient;
  server: McpServer;
}) => {
  server.tool(
    "list-traces",
    LIST_TRACES_DESCRIPTION,
    {
      projectIdentifier: z.string(),
      limit: z.number().min(1).max(100).default(10),
      since: z.string().optional(),
      lastNMinutes: z.number().min(1).optional(),
      includeAnnotations: z.boolean().default(false).optional(),
    },
    async ({
      projectIdentifier,
      limit,
      since,
      lastNMinutes,
      includeAnnotations = false,
    }) => {
      const startTime = resolveStartTime({ since, lastNMinutes });
      const projectId = await resolveProjectId({ client, projectIdentifier });
      const tracePage = await getTraces({
        client,
        project: { projectId },
        startTime,
        limit,
        sort: "start_time",
        order: "desc",
      });
      const traceIds = tracePage.traces.map((trace) => trace.trace_id);

      if (traceIds.length === 0) {
        return jsonResponse([]);
      }

      const response = await fetchProjectSpans({
        client,
        projectIdentifier: projectId,
        filters: {
          traceIds,
          limit: 1000,
        },
        totalLimit: undefined,
      });

      let spans = response.spans;
      if (includeAnnotations) {
        const annotations = await fetchSpanAnnotations({
          client,
          projectIdentifier: projectId,
          spanIds: spans
            .map((span) => span.context?.span_id)
            .filter((spanId): spanId is string => Boolean(spanId)),
        });
        spans = attachAnnotationsToSpans({
          spans,
          annotations,
        });
      }

      const spansByTraceId = groupSpansByTrace({ spans });
      const traces = traceIds.flatMap((traceId) => {
        const traceSpans = spansByTraceId.get(traceId);
        if (!traceSpans || traceSpans.length === 0) {
          return [];
        }

        return [buildTrace({ spans: traceSpans })];
      });

      return jsonResponse(traces);
    }
  );

  server.tool(
    "get-trace",
    GET_TRACE_DESCRIPTION,
    {
      projectIdentifier: z.string(),
      traceId: z.string(),
      includeAnnotations: z.boolean().default(false).optional(),
    },
    async ({ projectIdentifier, traceId, includeAnnotations = false }) => {
      const projectId = await resolveProjectId({ client, projectIdentifier });
      let spans = await fetchTraceSpans({
        client,
        projectId,
        traceId,
      });

      if (spans.length === 0) {
        const resolvedTraceId = await resolveTraceIdByPrefix({
          client,
          projectId,
          projectIdentifier,
          traceIdPrefix: traceId,
        });

        if (!resolvedTraceId) {
          throw new Error(
            `Trace not found for project "${projectIdentifier}": ${traceId}`
          );
        }

        spans = await fetchTraceSpans({
          client,
          projectId,
          traceId: resolvedTraceId,
        });
      }

      if (includeAnnotations) {
        const annotations = await fetchSpanAnnotations({
          client,
          projectIdentifier: projectId,
          spanIds: spans
            .map((span) => span.context?.span_id)
            .filter((spanId): spanId is string => Boolean(spanId)),
        });
        spans = attachAnnotationsToSpans({
          spans,
          annotations,
        });
      }

      return jsonResponse(buildTrace({ spans }));
    }
  );
};
