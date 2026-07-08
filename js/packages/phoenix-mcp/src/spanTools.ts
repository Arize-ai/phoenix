import type { PhoenixClient, Types } from "@arizeai/phoenix-client";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";

import { DEFAULT_PAGE_SIZE, MAX_SPAN_QUERY_LIMIT } from "./constants.js";
import { resolveProjectIdentifier } from "./projectUtils.js";
import { getResponseData } from "./responseUtils.js";
import {
  attachAnnotationsToSpans,
  extractSpanIds,
  fetchProjectSpans,
  fetchSpanAnnotations,
} from "./spanUtils.js";
import { jsonResponse } from "./toolResults.js";

// ---------------------------------------------------------------------------
// Tool descriptions
// ---------------------------------------------------------------------------

const GET_SPANS_DESCRIPTION = `Get spans from a project with filtering criteria.

Spans represent individual operations or units of work within a trace. They contain timing information,
attributes, and context about the operation being performed.

Example usage:
  Get recent spans from project "my-project"
  Get spans in a time range from project "my-project"

Expected return:
  Object containing spans array and optional next cursor for pagination.
  Example: {
    "spans": [
      {
        "id": "span123",
        "name": "http_request",
        "context": {
          "trace_id": "trace456",
          "span_id": "span123"
        },
        "start_time": "2024-01-01T12:00:00Z",
        "end_time": "2024-01-01T12:00:01Z",
        "attributes": {
          "http.method": "GET",
          "http.url": "/api/users"
        }
      }
    ],
    "nextCursor": "cursor_for_pagination"
  }`;

const GET_SPAN_ANNOTATIONS_DESCRIPTION = `Get span annotations for a list of span IDs.

Span annotations provide additional metadata, scores, or labels for spans. They can be created
by humans, LLMs, or code and help in analyzing and categorizing spans.

Example usage:
  Get annotations for spans ["span1", "span2"] from project "my-project"
  Get quality score annotations for span "span1" from project "my-project"

Expected return:
  Object containing annotations array and optional next cursor for pagination.
  Example: {
    "annotations": [
      {
        "id": "annotation123",
        "span_id": "span1",
        "name": "quality_score",
        "result": {
          "label": "good",
          "score": 0.95,
          "explanation": null
        },
        "annotator_kind": "LLM",
        "metadata": {
          "model": "gpt-4"
        }
      }
    ],
    "nextCursor": "cursor_for_pagination"
  }`;

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

/**
 * Register span-related MCP tools on the given server.
 */
export const initializeSpanTools = ({
  client,
  server,
  defaultProject,
}: {
  client: PhoenixClient;
  server: McpServer;
  defaultProject?: string;
}) => {
  server.tool(
    "get-spans",
    GET_SPANS_DESCRIPTION,
    {
      project_identifier: z.string().optional(),
      start_time: z.string().optional(),
      end_time: z.string().optional(),
      trace_ids: z.array(z.string()).optional(),
      parent_id: z.string().nullable().optional(),
      names: z.array(z.string()).optional(),
      span_kinds: z.array(z.string()).optional(),
      status_codes: z.array(z.enum(["OK", "ERROR", "UNSET"])).optional(),
      cursor: z.string().optional(),
      limit: z
        .number()
        .min(1)
        .max(MAX_SPAN_QUERY_LIMIT)
        .default(DEFAULT_PAGE_SIZE)
        .optional(),
      include_annotations: z.boolean().default(false).optional(),
    },
    async ({
      project_identifier,
      start_time,
      end_time,
      trace_ids,
      parent_id,
      names,
      span_kinds,
      status_codes,
      cursor,
      limit = DEFAULT_PAGE_SIZE,
      include_annotations = false,
    }) => {
      const resolvedProjectIdentifier = resolveProjectIdentifier({
        projectIdentifier: project_identifier,
        defaultProjectIdentifier: defaultProject,
      });

      const response = await fetchProjectSpans({
        client,
        projectIdentifier: resolvedProjectIdentifier,
        filters: {
          cursor,
          limit,
          startTime: start_time,
          endTime: end_time,
          traceIds: trace_ids,
          parentId: parent_id,
          names,
          spanKinds: span_kinds,
          statusCodes: status_codes,
        },
        totalLimit: limit,
      });

      const spans = include_annotations
        ? attachAnnotationsToSpans({
            spans: response.spans,
            annotations: await fetchSpanAnnotations({
              client,
              projectIdentifier: resolvedProjectIdentifier,
              spanIds: extractSpanIds(response.spans),
            }),
          })
        : response.spans;

      return jsonResponse({
        spans,
        nextCursor: response.nextCursor,
      });
    }
  );

  server.tool(
    "get-span-annotations",
    GET_SPAN_ANNOTATIONS_DESCRIPTION,
    {
      project_identifier: z.string().optional(),
      span_ids: z.array(z.string()),
      include_annotation_names: z.array(z.string()).optional(),
      exclude_annotation_names: z.array(z.string()).optional(),
      cursor: z.string().optional(),
      limit: z
        .number()
        .min(1)
        .max(MAX_SPAN_QUERY_LIMIT)
        .default(DEFAULT_PAGE_SIZE)
        .optional(),
    },
    async ({
      project_identifier,
      span_ids,
      include_annotation_names,
      exclude_annotation_names,
      cursor,
      limit = DEFAULT_PAGE_SIZE,
    }) => {
      const resolvedProjectIdentifier = resolveProjectIdentifier({
        projectIdentifier: project_identifier,
        defaultProjectIdentifier: defaultProject,
      });

      const params: NonNullable<
        Types["V1"]["operations"]["listSpanAnnotationsBySpanIds"]["parameters"]["query"]
      > = {
        span_ids,
        limit,
      };

      if (cursor) {
        params.cursor = cursor;
      }

      if (include_annotation_names) {
        params.include_annotation_names = include_annotation_names;
      }

      if (exclude_annotation_names) {
        params.exclude_annotation_names = exclude_annotation_names;
      }

      const response = await client.GET(
        "/v1/projects/{project_identifier}/span_annotations",
        {
          params: {
            path: {
              project_identifier: resolvedProjectIdentifier,
            },
            query: params,
          },
        }
      );
      const data = getResponseData({
        response,
        errorPrefix: `Failed to fetch span annotations for project "${resolvedProjectIdentifier}"`,
      });

      return jsonResponse({
        annotations: data.data,
        nextCursor: data.next_cursor || null,
      });
    }
  );
};
