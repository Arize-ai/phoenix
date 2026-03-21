import type { PhoenixClient } from "@arizeai/phoenix-client";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";

import { getResponseData } from "./responseUtils.js";
import { jsonResponse } from "./toolResults.js";

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
      limit: z.number().min(1).max(500).default(100).optional(),
      cursor: z.string().optional(),
      includeExperimentProjects: z.boolean().default(false).optional(),
    },
    async ({ limit = 100, cursor, includeExperimentProjects = false }) => {
      const projects: unknown[] = [];
      let nextCursor = cursor;

      do {
        const pageLimit = Math.min(limit - projects.length, 100);
        const response = await client.GET("/v1/projects", {
          params: {
            query: {
              limit: pageLimit,
              cursor: nextCursor,
              include_experiment_projects: includeExperimentProjects,
            },
          },
        });
        const data = getResponseData({
          response,
          errorPrefix: "Failed to fetch projects",
        });

        projects.push(...data.data);
        nextCursor = data.next_cursor || undefined;
      } while (nextCursor && projects.length < limit);

      return jsonResponse(projects.slice(0, limit));
    }
  );

  server.tool(
    "get-project",
    GET_PROJECT_DESCRIPTION,
    {
      projectIdentifier: z.string(),
    },
    async ({ projectIdentifier }) => {
      const response = await client.GET("/v1/projects/{project_identifier}", {
        params: {
          path: {
            project_identifier: projectIdentifier,
          },
        },
      });
      const project = getResponseData({
        response,
        errorPrefix: `Failed to fetch project "${projectIdentifier}"`,
      }).data;

      return jsonResponse(project);
    }
  );
};
