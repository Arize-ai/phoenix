import type { PhoenixClient, Types } from "@arizeai/phoenix-client";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";

import { getResponseData } from "./client.js";
import { requirePreferredIdentifier } from "./identifiers.js";
import {
  attachAnnotationsToSpans,
  fetchProjectSpans,
  fetchSpanAnnotations,
} from "./spanUtils.js";
import { jsonResponse } from "./toolResults.js";

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

export const initializeSpanTools = ({
  client,
  server,
}: {
  client: PhoenixClient;
  server: McpServer;
}) => {
  server.tool(
    "get-spans",
    GET_SPANS_DESCRIPTION,
    {
      projectIdentifier: z.string().optional(),
      projectName: z.string().optional(),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      traceIds: z.array(z.string()).optional(),
      parentId: z.string().nullable().optional(),
      names: z.array(z.string()).optional(),
      spanKinds: z.array(z.string()).optional(),
      statusCodes: z.array(z.string()).optional(),
      cursor: z.string().optional(),
      limit: z.number().min(1).max(1000).default(100).optional(),
      includeAnnotations: z.boolean().default(false).optional(),
    },
    async ({
      projectIdentifier,
      projectName,
      startTime,
      endTime,
      traceIds,
      parentId,
      names,
      spanKinds,
      statusCodes,
      cursor,
      limit = 100,
      includeAnnotations = false,
    }) => {
      const resolvedProjectIdentifier = requirePreferredIdentifier({
        identifier: projectIdentifier,
        legacyIdentifier: projectName,
        label: "projectIdentifier",
        legacyLabel: "projectName",
      });

      const response = await fetchProjectSpans({
        client,
        projectIdentifier: resolvedProjectIdentifier,
        filters: {
          cursor,
          limit,
          startTime,
          endTime,
          traceIds,
          parentId,
          names,
          spanKinds,
          statusCodes,
        },
        totalLimit: limit,
      });

      const spans = includeAnnotations
        ? attachAnnotationsToSpans({
            spans: response.spans,
            annotations: await fetchSpanAnnotations({
              client,
              projectIdentifier: resolvedProjectIdentifier,
              spanIds: response.spans
                .map((span) => span.context?.span_id)
                .filter((spanId): spanId is string => Boolean(spanId)),
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
      projectIdentifier: z.string().optional(),
      projectName: z.string().optional(),
      spanIds: z.array(z.string()),
      includeAnnotationNames: z.array(z.string()).optional(),
      excludeAnnotationNames: z.array(z.string()).optional(),
      cursor: z.string().optional(),
      limit: z.number().min(1).max(1000).default(100).optional(),
    },
    async ({
      projectIdentifier,
      projectName,
      spanIds,
      includeAnnotationNames,
      excludeAnnotationNames,
      cursor,
      limit = 100,
    }) => {
      const resolvedProjectIdentifier = requirePreferredIdentifier({
        identifier: projectIdentifier,
        legacyIdentifier: projectName,
        label: "projectIdentifier",
        legacyLabel: "projectName",
      });

      const params: NonNullable<
        Types["V1"]["operations"]["listSpanAnnotationsBySpanIds"]["parameters"]["query"]
      > = {
        span_ids: spanIds,
        limit,
      };

      if (cursor) {
        params.cursor = cursor;
      }

      if (includeAnnotationNames) {
        params.include_annotation_names = includeAnnotationNames;
      }

      if (excludeAnnotationNames) {
        params.exclude_annotation_names = excludeAnnotationNames;
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
