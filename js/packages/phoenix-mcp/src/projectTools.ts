import { PhoenixClient } from "@arizeai/phoenix-client";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";

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

const GET_PROJECT_DESCRIPTION = `Get details of a specific project by ID or name.

Example usage:
  Get details for project "default"
  Get details for project UHJvamVjdDox

Expected return:
  Project object with metadata.
  Example: {
    "id": "UHJvamVjdDox",
    "name": "default", 
    "description": "Default project for traces"
  }`;

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
      limit: z.number().min(1).max(100).default(100).optional(),
      cursor: z.string().optional(),
      includeExperimentProjects: z.boolean().default(false).optional(),
    },
    async ({ limit = 100, cursor, includeExperimentProjects = false }) => {
      const response = await client.GET("/v1/projects", {
        params: {
          query: { 
            limit,
            cursor,
            include_experiment_projects: includeExperimentProjects,
          },
        },
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response.data?.data, null, 2),
          },
        ],
      };
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
          path: { project_identifier: projectIdentifier },
        },
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response.data, null, 2),
          },
        ],
      };
    }
  );
}; 