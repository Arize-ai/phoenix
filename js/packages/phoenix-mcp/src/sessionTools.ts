import type { PhoenixClient, Types } from "@arizeai/phoenix-client";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";

import { requireIdentifier } from "./identifiers.js";
import { getResponseData } from "./responseUtils.js";
import { jsonResponse } from "./toolResults.js";

type SessionAnnotationsQuery = NonNullable<
  Types["V1"]["operations"]["listSessionAnnotationsBySessionIds"]["parameters"]["query"]
>;

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
  const annotations: unknown[] = [];
  let cursor: string | undefined;

  do {
    const query: SessionAnnotationsQuery = {
      session_ids: [sessionId],
      limit: 100,
    };

    if (cursor) {
      query.cursor = cursor;
    }

    const response = await client.GET(
      "/v1/projects/{project_identifier}/session_annotations",
      {
        params: {
          path: {
            project_identifier: normalizedProjectIdentifier,
          },
          query,
        },
      }
    );
    const data = getResponseData({
      response,
      errorPrefix: `Failed to fetch annotations for session "${sessionId}"`,
    });

    annotations.push(...data.data);
    cursor = data.next_cursor || undefined;
  } while (cursor);

  return annotations;
}

export const initializeSessionTools = ({
  client,
  server,
}: {
  client: PhoenixClient;
  server: McpServer;
}) => {
  server.tool(
    "list-sessions",
    LIST_SESSIONS_DESCRIPTION,
    {
      projectIdentifier: z.string(),
      limit: z.number().min(1).max(100).default(10),
      order: z.enum(["asc", "desc"]).default("desc").optional(),
    },
    async ({ projectIdentifier, limit, order = "desc" }) => {
      const normalizedProjectIdentifier = requireIdentifier({
        identifier: projectIdentifier,
        label: "projectIdentifier",
      });
      const sessions: unknown[] = [];
      let cursor: string | undefined;

      do {
        const pageLimit = Math.min(limit - sessions.length, 100);
        const response = await client.GET(
          "/v1/projects/{project_identifier}/sessions",
          {
            params: {
              path: {
                project_identifier: normalizedProjectIdentifier,
              },
              query: {
                cursor,
                limit: pageLimit,
                order,
              },
            },
          }
        );
        const data = getResponseData({
          response,
          errorPrefix: `Failed to fetch sessions for project "${normalizedProjectIdentifier}"`,
        });

        sessions.push(...data.data);
        cursor = data.next_cursor || undefined;
      } while (cursor && sessions.length < limit);

      return jsonResponse(sessions.slice(0, limit));
    }
  );

  server.tool(
    "get-session",
    GET_SESSION_DESCRIPTION,
    {
      sessionIdentifier: z.string(),
      includeAnnotations: z.boolean().default(false).optional(),
    },
    async ({ sessionIdentifier, includeAnnotations = false }) => {
      const response = await client.GET("/v1/sessions/{session_identifier}", {
        params: {
          path: {
            session_identifier: sessionIdentifier,
          },
        },
      });
      const session = getResponseData({
        response,
        errorPrefix: `Failed to fetch session "${sessionIdentifier}"`,
      }).data;

      if (!includeAnnotations) {
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
