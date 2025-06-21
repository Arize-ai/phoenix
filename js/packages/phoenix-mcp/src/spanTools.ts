import { PhoenixClient, Types } from "@arizeai/phoenix-client";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";

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
      projectName: z.string(),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      cursor: z.string().optional(),
      limit: z.number().min(1).max(1000).default(100).optional(),
    },
    async ({ projectName, startTime, endTime, cursor, limit = 100 }) => {
      const params: NonNullable<
        Types["V1"]["operations"]["getSpans"]["parameters"]["query"]
      > = {
        limit,
      };

      if (cursor) {
        params.cursor = cursor;
      }

      if (startTime) {
        params.start_time = startTime;
      }

      if (endTime) {
        params.end_time = endTime;
      }

      const response = await client.GET(
        "/v1/projects/{project_identifier}/spans",
        {
          params: {
            path: {
              project_identifier: projectName,
            },
            query: params,
          },
        }
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                spans: response.data?.data ?? [],
                nextCursor: response.data?.next_cursor ?? null,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.tool(
    "get-span-annotations",
    GET_SPAN_ANNOTATIONS_DESCRIPTION,
    {
      projectName: z.string(),
      spanIds: z.array(z.string()),
      includeAnnotationNames: z.array(z.string()).optional(),
      excludeAnnotationNames: z.array(z.string()).optional(),
      cursor: z.string().optional(),
      limit: z.number().min(1).max(1000).default(100).optional(),
    },
    async ({
      projectName,
      spanIds,
      includeAnnotationNames,
      excludeAnnotationNames,
      cursor,
      limit = 100,
    }) => {
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
              project_identifier: projectName,
            },
            query: params,
          },
        }
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                annotations: response.data?.data ?? [],
                nextCursor: response.data?.next_cursor ?? null,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
};
