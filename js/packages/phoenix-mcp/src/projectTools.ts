import type { PhoenixClient } from "@arizeai/phoenix-client";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";

import { MAX_LIST_LIMIT } from "./constants.js";
import { fetchAllPages } from "./pagination.js";
import { getResponseData } from "./responseUtils.js";
import { jsonResponse } from "./toolResults.js";

// ---------------------------------------------------------------------------
// Tool descriptions
// ---------------------------------------------------------------------------

const LIST_PROJECTS_DESCRIPTION = `Get a list of all projects.

Projects are containers for organizing traces, spans, and other observability data.
Each project has a unique name and can contain traces from different applications or experiments.

Example usage:
  Show me all available projects

Expected return:
  Array of project objects with metadata.
  Example: [
    {
      "id": "UHJvamVjdDox",
      "name": "default",
      "description": "Default project for traces"
    },
    {
      "id": "UHJvamVjdDoy",
      "name": "my-experiment",
      "description": "Project for my ML experiment"
    }
  ]`;

const GET_PROJECT_DESCRIPTION = `Get a project by name or ID.

Example usage:
  Show me the project "default"

Expected return:
  A single project object with metadata.`;

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

/**
 * Register project-related MCP tools on the given server.
 */
export const initializeProjectTools = ({
  client,
  server,
}: {
  client: PhoenixClient;
  server: McpServer;
}) => {
  server.tool(
    "list-projects",
    LIST_PROJECTS_DESCRIPTION,
    {
      limit: z.number().min(1).max(MAX_LIST_LIMIT).default(100).optional(),
      cursor: z.string().optional(),
      include_experiment_projects: z.boolean().default(false).optional(),
    },
    async ({ limit = 100, cursor, include_experiment_projects = false }) => {
      const projects = await fetchAllPages({
        limit,
        initialCursor: cursor,
        fetchPage: async (pageCursor, pageSize) => {
          const response = await client.GET("/v1/projects", {
            params: {
              query: {
                limit: pageSize,
                cursor: pageCursor,
                include_experiment_projects,
              },
            },
          });
          const data = getResponseData({
            response,
            errorPrefix: "Failed to fetch projects",
          });
          return { data: data.data, nextCursor: data.next_cursor || undefined };
        },
      });

      return jsonResponse(projects);
    }
  );

  server.tool(
    "get-project",
    GET_PROJECT_DESCRIPTION,
    {
      project_identifier: z.string(),
    },
    async ({ project_identifier }) => {
      const response = await client.GET("/v1/projects/{project_identifier}", {
        params: {
          path: { project_identifier },
        },
      });
      const project = getResponseData({
        response,
        errorPrefix: `Failed to fetch project "${project_identifier}"`,
      }).data;

      return jsonResponse(project);
    }
  );
};
