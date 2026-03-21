import type { PhoenixClient } from "@arizeai/phoenix-client";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";

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

function sortTracesByStartTimeDescending<TTrace extends { startTime?: string }>(
  traces: TTrace[]
): TTrace[] {
  return [...traces].sort((leftTrace, rightTrace) => {
    const leftTime = leftTrace.startTime
      ? Date.parse(leftTrace.startTime)
      : Number.NaN;
    const rightTime = rightTrace.startTime
      ? Date.parse(rightTrace.startTime)
      : Number.NaN;

    if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
      return 0;
    }

    return rightTime - leftTime;
  });
}

async function fetchTraceSpans({
  client,
  projectIdentifier,
  traceId,
}: {
  client: PhoenixClient;
  projectIdentifier: string;
  traceId: string;
}) {
  const allSpans: Awaited<ReturnType<typeof fetchProjectSpans>>["spans"] = [];
  let cursor: string | null = null;

  do {
    const response = await fetchProjectSpans({
      client,
      projectIdentifier,
      filters: {
        cursor: cursor || undefined,
        limit: 1000,
      },
      totalLimit: undefined,
    });

    const matchingSpans = response.spans.filter(
      (span) =>
        span.context.trace_id === traceId ||
        span.context.trace_id.startsWith(traceId)
    );

    allSpans.push(...matchingSpans);

    if (allSpans.length > 0) {
      return allSpans;
    }

    cursor = response.nextCursor;
  } while (cursor);

  return allSpans;
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
      const response = await fetchProjectSpans({
        client,
        projectIdentifier,
        filters: {
          startTime,
        },
        totalLimit: limit * 10,
      });

      let spans = response.spans;
      if (includeAnnotations) {
        const annotations = await fetchSpanAnnotations({
          client,
          projectIdentifier,
          spanIds: spans
            .map((span) => span.context?.span_id)
            .filter((spanId): spanId is string => Boolean(spanId)),
        });
        spans = attachAnnotationsToSpans({
          spans,
          annotations,
        });
      }

      const traces = sortTracesByStartTimeDescending(
        Array.from(groupSpansByTrace({ spans }).values()).map((traceSpans) =>
          buildTrace({ spans: traceSpans })
        )
      ).slice(0, limit);

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
      let spans = await fetchTraceSpans({
        client,
        projectIdentifier,
        traceId,
      });

      if (spans.length === 0) {
        throw new Error(
          `Trace not found for project "${projectIdentifier}": ${traceId}`
        );
      }

      if (includeAnnotations) {
        const annotations = await fetchSpanAnnotations({
          client,
          projectIdentifier,
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
