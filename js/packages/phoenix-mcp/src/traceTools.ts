import type { PhoenixClient } from "@arizeai/phoenix-client";
import { getTraces } from "@arizeai/phoenix-client/traces";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";

import {
  DEFAULT_TRACE_PAGE_SIZE,
  MAX_SPAN_QUERY_LIMIT,
  MAX_TRACE_PAGE_SIZE,
} from "./constants.js";
import { resolveProjectIdentifier } from "./projectUtils.js";
import {
  attachAnnotationsToSpans,
  extractSpanIds,
  fetchProjectSpans,
  fetchSpanAnnotations,
  resolveStartTime,
} from "./spanUtils.js";
import { jsonResponse } from "./toolResults.js";
import { buildTrace, groupSpansByTrace } from "./traceUtils.js";

// ---------------------------------------------------------------------------
// Tool descriptions
// ---------------------------------------------------------------------------

const LIST_TRACES_DESCRIPTION = `List traces for a project.

This tool groups project spans into traces and returns the newest traces first.

Example usage:
  Show me the last 10 traces for project "default"
  Show me recent traces from the last 30 minutes for project "checkout"

Expected return:
  Array of trace objects with grouped spans and summary timing information.`;

const GET_TRACE_DESCRIPTION = `Get a single trace by its exact trace ID within a project.

Example usage:
  Show me trace "abc123def456" from project "default"

Expected return:
  A trace object with all spans that belong to the trace.`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fetch every span belonging to a single trace.
 */
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
      limit: MAX_SPAN_QUERY_LIMIT,
    },
    totalLimit: undefined,
  });

  return response.spans;
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

/**
 * Register trace-related MCP tools on the given server.
 */
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
      project_identifier: z.string().optional(),
      limit: z
        .number()
        .min(1)
        .max(MAX_TRACE_PAGE_SIZE)
        .default(DEFAULT_TRACE_PAGE_SIZE),
      since: z.string().optional(),
      last_n_minutes: z.number().min(1).optional(),
      include_annotations: z.boolean().default(false).optional(),
    },
    async ({
      project_identifier,
      limit,
      since,
      last_n_minutes,
      include_annotations = false,
    }) => {
      const startTime = resolveStartTime({
        since,
        lastNMinutes: last_n_minutes,
      });
      const normalizedProjectIdentifier = resolveProjectIdentifier({
        projectIdentifier: project_identifier,
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
          limit: MAX_SPAN_QUERY_LIMIT,
        },
        totalLimit: undefined,
      });

      let spans = response.spans;
      if (include_annotations) {
        const annotations = await fetchSpanAnnotations({
          client,
          projectIdentifier: normalizedProjectIdentifier,
          spanIds: extractSpanIds(spans),
        });
        spans = attachAnnotationsToSpans({ spans, annotations });
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
      project_identifier: z.string().optional(),
      trace_id: z.string(),
      include_annotations: z.boolean().default(false).optional(),
    },
    async ({ project_identifier, trace_id, include_annotations = false }) => {
      const normalizedProjectIdentifier = resolveProjectIdentifier({
        projectIdentifier: project_identifier,
        defaultProjectIdentifier: defaultProject,
      });
      const spans = await fetchTraceSpans({
        client,
        projectIdentifier: normalizedProjectIdentifier,
        traceId: trace_id,
      });

      if (spans.length === 0) {
        throw new Error(
          `Trace not found for project "${normalizedProjectIdentifier}": ${trace_id}`
        );
      }

      if (include_annotations) {
        const annotations = await fetchSpanAnnotations({
          client,
          projectIdentifier: normalizedProjectIdentifier,
          spanIds: extractSpanIds(spans),
        });
        return jsonResponse(
          buildTrace({
            spans: attachAnnotationsToSpans({ spans, annotations }),
          })
        );
      }

      return jsonResponse(buildTrace({ spans }));
    }
  );
};
