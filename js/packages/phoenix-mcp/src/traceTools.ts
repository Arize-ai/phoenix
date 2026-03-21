import type { PhoenixClient } from "@arizeai/phoenix-client";
import { getTraces } from "@arizeai/phoenix-client/traces";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";

import { requireIdentifier } from "./identifiers.js";
import { resolveProjectIdentifier } from "./projectUtils.js";
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
  projectIdentifier,
  traceId,
}: {
  client: PhoenixClient;
  projectIdentifier: string;
  traceId: string;
}) {
  const response = await fetchProjectSpans({
    client,
    projectIdentifier,
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
  projectIdentifier,
  traceIdPrefix,
  pageLimit = 100,
}: {
  client: PhoenixClient;
  projectIdentifier: string;
  traceIdPrefix: string;
  pageLimit?: number;
}): Promise<string | null> {
  const normalizedProjectIdentifier = requireIdentifier({
    identifier: projectIdentifier,
    label: "projectIdentifier",
  });
  let cursor: string | null = null;
  const matchingTraceIds = new Set<string>();

  do {
    const tracePage = await getTraces({
      client,
      project: { project: normalizedProjectIdentifier },
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
          `Trace ID prefix "${traceIdPrefix}" is ambiguous in project "${normalizedProjectIdentifier}": ${Array.from(matchingTraceIds).join(", ")}`
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
  defaultProject,
}: {
  client: PhoenixClient;
  server: McpServer;
  defaultProject?: string;
}) => {
  server.tool(
    "list-traces",
    LIST_TRACES_DESCRIPTION,
    {
      projectIdentifier: z.string().optional(),
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
      const normalizedProjectIdentifier = resolveProjectIdentifier({
        projectIdentifier,
        defaultProjectIdentifier: defaultProject,
      });
      const tracePage = await getTraces({
        client,
        project: { project: normalizedProjectIdentifier },
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
        projectIdentifier: normalizedProjectIdentifier,
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
          projectIdentifier: normalizedProjectIdentifier,
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
      projectIdentifier: z.string().optional(),
      traceId: z.string(),
      includeAnnotations: z.boolean().default(false).optional(),
    },
    async ({ projectIdentifier, traceId, includeAnnotations = false }) => {
      const normalizedProjectIdentifier = resolveProjectIdentifier({
        projectIdentifier,
        defaultProjectIdentifier: defaultProject,
      });
      let spans = await fetchTraceSpans({
        client,
        projectIdentifier: normalizedProjectIdentifier,
        traceId,
      });

      if (spans.length === 0) {
        const resolvedTraceId = await resolveTraceIdByPrefix({
          client,
          projectIdentifier: normalizedProjectIdentifier,
          traceIdPrefix: traceId,
        });

        if (!resolvedTraceId) {
          throw new Error(
            `Trace not found for project "${normalizedProjectIdentifier}": ${traceId}`
          );
        }

        spans = await fetchTraceSpans({
          client,
          projectIdentifier: normalizedProjectIdentifier,
          traceId: resolvedTraceId,
        });
      }

      if (includeAnnotations) {
        const annotations = await fetchSpanAnnotations({
          client,
          projectIdentifier: normalizedProjectIdentifier,
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
