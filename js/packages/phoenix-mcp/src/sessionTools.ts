import type { PhoenixClient, Types } from "@arizeai/phoenix-client";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";

import { DEFAULT_TRACE_PAGE_SIZE, MAX_SESSION_PAGE_SIZE } from "./constants.js";
import { requireIdentifier } from "./identifiers.js";
import { fetchAllPages } from "./pagination.js";
import { resolveProjectIdentifier } from "./projectUtils.js";
import { getResponseData } from "./responseUtils.js";
import { jsonResponse } from "./toolResults.js";

type SessionAnnotationsQuery = NonNullable<
  Types["V1"]["operations"]["listSessionAnnotationsBySessionIds"]["parameters"]["query"]
>;

// ---------------------------------------------------------------------------
// Tool descriptions
// ---------------------------------------------------------------------------

const LIST_SESSIONS_DESCRIPTION = `List sessions for a project.

Sessions represent conversation flows grouped across traces.

Example usage:
  Show me the last 10 sessions for project "default"

Expected return:
  Array of session objects ordered by the requested sort order.`;

const GET_SESSION_DESCRIPTION = `Get a single session by GlobalID or user-provided session_id.

Example usage:
  Show me session "chat-123"

Expected return:
  A session object and, optionally, its annotations.`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fetch all annotations for a single session, paginating internally.
 */
async function fetchSessionAnnotations({
  client,
  projectIdentifier,
  sessionId,
}: {
  client: PhoenixClient;
  projectIdentifier: string;
  sessionId: string;
}) {
  const normalizedProjectIdentifier = requireIdentifier({
    identifier: projectIdentifier,
    label: "projectIdentifier",
  });

  return fetchAllPages({
    limit: Infinity,
    fetchPage: async (cursor, pageSize) => {
      const query: SessionAnnotationsQuery = {
        session_ids: [sessionId],
        limit: pageSize,
      };

      if (cursor) {
        query.cursor = cursor;
      }

      const response = await client.GET(
        "/v1/projects/{project_identifier}/session_annotations",
        {
          params: {
            path: { project_identifier: normalizedProjectIdentifier },
            query,
          },
        }
      );
      const data = getResponseData({
        response,
        errorPrefix: `Failed to fetch annotations for session "${sessionId}"`,
      });
      return { data: data.data, nextCursor: data.next_cursor || undefined };
    },
  });
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

/**
 * Register session-related MCP tools on the given server.
 */
export const initializeSessionTools = ({
  client,
  server,
  defaultProject,
}: {
  client: PhoenixClient;
  server: McpServer;
  defaultProject?: string;
}) => {
  server.tool(
    "list-sessions",
    LIST_SESSIONS_DESCRIPTION,
    {
      project_identifier: z.string().optional(),
      limit: z
        .number()
        .min(1)
        .max(MAX_SESSION_PAGE_SIZE)
        .default(DEFAULT_TRACE_PAGE_SIZE),
      order: z.enum(["asc", "desc"]).default("desc").optional(),
    },
    async ({ project_identifier, limit, order = "desc" }) => {
      const normalizedProjectIdentifier = resolveProjectIdentifier({
        projectIdentifier: project_identifier,
        defaultProjectIdentifier: defaultProject,
      });

      const sessions = await fetchAllPages({
        limit,
        fetchPage: async (cursor, pageSize) => {
          const response = await client.GET(
            "/v1/projects/{project_identifier}/sessions",
            {
              params: {
                path: { project_identifier: normalizedProjectIdentifier },
                query: { cursor, limit: pageSize, order },
              },
            }
          );
          const data = getResponseData({
            response,
            errorPrefix: `Failed to fetch sessions for project "${normalizedProjectIdentifier}"`,
          });
          return { data: data.data, nextCursor: data.next_cursor || undefined };
        },
      });

      return jsonResponse(sessions);
    }
  );

  server.tool(
    "get-session",
    GET_SESSION_DESCRIPTION,
    {
      session_identifier: z.string(),
      include_annotations: z.boolean().default(false).optional(),
    },
    async ({ session_identifier, include_annotations = false }) => {
      const response = await client.GET("/v1/sessions/{session_identifier}", {
        params: {
          path: { session_identifier },
        },
      });
      const session = getResponseData({
        response,
        errorPrefix: `Failed to fetch session "${session_identifier}"`,
      }).data;

      if (!include_annotations) {
        return jsonResponse(session);
      }

      const annotations = await fetchSessionAnnotations({
        client,
        projectIdentifier: session.project_id,
        sessionId: session.session_id,
      });

      return jsonResponse({
        session,
        annotations,
      });
    }
  );
};
